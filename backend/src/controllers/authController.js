import { UserModel, hashPassword, verifyPassword, toPublicUser } from '../models/userModel.js';
import { signToken } from '../middleware/authMiddleware.js';
import { verifyGoogleIdToken } from '../services/googleAuth.js';

/**
 * Decides what a verified Google sign-in should do (pure, unit-tested):
 * - 'login'  a user is already linked to this Google identity (google_sub)
 * - 'link'   a password account exists with the same verified email:
 *            attach google_sub to it and log in (Google has verified the
 *            user owns that email, so linking cannot lock the owner out —
 *            their password keeps working too)
 * - 'create' no account yet: create one (with default categories)
 */
export function decideGoogleAccountAction({ byGoogleSub, byEmail }) {
  if (byGoogleSub) return 'login';
  if (byEmail) return 'link';
  return 'create';
}

/**
 * Auth Controller — Phase 1 (Task 1, Arpan Khatiwada, reviewed by Suman Raut)
 * Coordinated with Renuka Karmacharya (Auth Frontend)
 *
 * Contract: docs/INTEGRATION_CONTRACT.md section 3.2
 * - POST /api/auth/register  { display_name, email, password } -> 201 { status, data: { token, user } }
 * - POST /api/auth/login     { email, password }               -> 200 { status, data: { token, user } }
 * - GET  /api/auth/me        (Bearer token, requireAuth)       -> 200 { status, data: { user } }
 *
 * All JSON keys are snake_case. password_hash is never returned.
 * NOTE: The contract currently accepts display_name only. The newer
 * frontend fields (username, first_name, last_name, date_of_birth)
 * are NOT accepted here until the contract is amended and approved
 * by Arpan + Suman — see frontend/src/features/auth/README.md.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateRegisterInput(body) {
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : '';
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!displayName || !email || !password) {
    return { error: 'display_name, email, and password are required' };
  }
  if (displayName.length > 100) return { error: 'display_name must be 100 characters or fewer' };
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) return { error: 'email must be a valid email address' };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: `password must be ${MAX_PASSWORD_LENGTH} characters or fewer` };
  }
  return { displayName, email, password };
}

export const authController = {
  async register(req, res, next) {
    try {
      const input = validateRegisterInput(req.body);
      if (input.error) return res.status(400).json({ error: input.error, status: 400 });

      const existing = await UserModel.findByEmail(input.email);
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists', status: 409 });
      }

      const passwordHash = hashPassword(input.password);
      let user;
      try {
        user = await UserModel.create({
          displayName: input.displayName,
          email: input.email,
          passwordHash,
        });
      } catch (err) {
        // Race condition: two registrations with the same email.
        if (err && err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'An account with this email already exists', status: 409 });
        }
        throw err;
      }

      const token = signToken(user);
      return res.status(201).json({ status: 'ok', data: { token, user } });
    } catch (err) {
      return next(err);
    }
  },

  async login(req, res, next) {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required', status: 400 });
      }

      const row = await UserModel.findByEmail(email);
      // One generic message for both "no such user" and "wrong
      // password" so the endpoint does not reveal which emails exist.
      if (!row || !verifyPassword(password, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password', status: 401 });
      }

      const user = toPublicUser(row);
      const token = signToken(user);
      return res.status(200).json({ status: 'ok', data: { token, user } });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/auth/google  { id_token }
   * Verifies the Google ID token, then logs in / links / creates the
   * account per decideGoogleAccountAction, and returns our own JWT in
   * the same envelope as login/register. Same user -> same account,
   * whether they use a password or Google.
   * Requires migration 003 and GOOGLE_CLIENT_ID in backend/.env.
   */
  async google(req, res, next) {
    try {
      const idToken = typeof req.body?.id_token === 'string' ? req.body.id_token : '';
      if (!idToken) return res.status(400).json({ error: 'id_token is required', status: 400 });

      let googleUser;
      try {
        googleUser = await verifyGoogleIdToken(idToken);
      } catch (err) {
        if (err.status === 500) return next(err); // server not configured
        return res.status(401).json({ error: 'Google sign-in could not be verified', status: 401 });
      }

      const byGoogleSub = await UserModel.findByGoogleSub(googleUser.sub);
      const byEmailRow = byGoogleSub ? null : await UserModel.findByEmail(googleUser.email);
      const action = decideGoogleAccountAction({
        byGoogleSub,
        byEmail: byEmailRow ? toPublicUser(byEmailRow) : null,
      });

      if (action === 'login') {
        const token = signToken(byGoogleSub);
        return res.status(200).json({ status: 'ok', data: { token, user: byGoogleSub } });
      }
      if (action === 'link') {
        const user = toPublicUser(byEmailRow);
        await UserModel.linkGoogleSub(user.id, googleUser.sub);
        const token = signToken(user);
        return res.status(200).json({ status: 'ok', data: { token, user } });
      }
      const displayName = (googleUser.name || googleUser.email.split('@')[0]).slice(0, 100);
      const user = await UserModel.createGoogleUser({
        displayName,
        email: googleUser.email,
        googleSub: googleUser.sub,
      });
      const token = signToken(user);
      return res.status(201).json({ status: 'ok', data: { token, user } });
    } catch (err) {
      return next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found', status: 404 });
      return res.status(200).json({ status: 'ok', data: { user } });
    } catch (err) {
      return next(err);
    }
  },
};
