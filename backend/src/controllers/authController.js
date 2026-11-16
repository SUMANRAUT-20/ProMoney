import {
  UserModel,
  hashPassword,
  verifyPassword,
  toPublicUser,
  validatePasswordPolicy,
} from '../models/userModel.js';
import {
  clearSessionCookie,
  extractRequestToken,
  setSessionCookie,
  signToken,
  verifyToken,
} from '../middleware/authMiddleware.js';
import { verifyGoogleIdToken } from '../services/googleAuth.js';

export function decideGoogleAccountAction({ byGoogleSub, byEmail }) {
  if (byGoogleSub) return 'login';
  if (byEmail) return 'link';
  return 'create';
}

/**
 * Auth Controller — Phase 1 & Phase 3 Security Hardening
 *
 * Security controls implemented (Phase 3):
 * 1. Session token issued in an httpOnly cookie (`pm_session`).
 * 2. Revocation via `users.token_version` (`POST /api/auth/logout` &
 *    `POST /api/auth/logout-all`).
 * 3. Login rate limit: 10 failed attempts per email+IP per 15 minutes -> 429,
 *    and even the correct password waits while limited.
 * 4. Password policy: minimum 10 characters, at least one letter and one digit.
 * 5. No account-existence leaks: identical error message + dummy scrypt
 *    hash verification for unknown emails so timing does not leak.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LOGIN_RATE_LIMIT_MAX = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Pre-computed dummy scrypt hash so unknown-email login attempts run the
// exact same scrypt derivation work as real accounts (Phase 3 Rule 5).
export const DUMMY_PASSWORD_HASH = hashPassword('DummyTimingSafetyPassword123');

const loginFailuresByKey = new Map();

export function resetLoginRateLimiter() {
  loginFailuresByKey.clear();
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req?.ip || req?.socket?.remoteAddress || '127.0.0.1';
}

function getRateKey(email, req) {
  return `${normalizeEmail(email)}|${getClientIp(req)}`;
}

function isLoginRateLimited(rateKey, now = Date.now()) {
  const timestamps = loginFailuresByKey.get(rateKey);
  if (!timestamps || timestamps.length === 0) return false;
  const fresh = timestamps.filter((t) => now - t < LOGIN_RATE_LIMIT_WINDOW_MS);
  if (fresh.length === 0) {
    loginFailuresByKey.delete(rateKey);
    return false;
  }
  loginFailuresByKey.set(rateKey, fresh);
  return fresh.length >= LOGIN_RATE_LIMIT_MAX;
}

function recordLoginFailure(rateKey, now = Date.now()) {
  const timestamps = loginFailuresByKey.get(rateKey) || [];
  const fresh = timestamps.filter((t) => now - t < LOGIN_RATE_LIMIT_WINDOW_MS);
  fresh.push(now);
  loginFailuresByKey.set(rateKey, fresh);
}

function clearLoginFailures(rateKey) {
  loginFailuresByKey.delete(rateKey);
}

export function validateRegisterInput(body) {
  const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : '';
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!displayName || !email || !password) {
    return { error: 'display_name, email, and password are required' };
  }
  if (displayName.length > 100) return { error: 'display_name must be 100 characters or fewer' };
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) return { error: 'email must be a valid email address' };
  const policyError = validatePasswordPolicy(password, 'password');
  if (policyError) return { error: policyError };
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
        if (err && err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'An account with this email already exists', status: 409 });
        }
        throw err;
      }

      const token = signToken(user, { tokenVersion: 0 });
      setSessionCookie(res, token);
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

      const now = Number(req.nowOverride ?? Date.now());
      const rateKey = getRateKey(email, req);

      // Phase 3 Rule 3: 10 failed attempts per email+IP per 15 minutes -> 429,
      // and even the correct password waits while limited.
      if (isLoginRateLimited(rateKey, now)) {
        return res.status(429).json({
          error: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
          status: 429,
        });
      }

      const row = await UserModel.findByEmail(email);
      // Phase 3 Rule 5: Run dummy scrypt verification when the email does not
      // exist (or has no password) so response message and timing never leak
      // whether an account exists.
      const hashToCheck = row?.password_hash || DUMMY_PASSWORD_HASH;
      const passwordValid = verifyPassword(password, hashToCheck);

      if (!row || !row.password_hash || !passwordValid) {
        recordLoginFailure(rateKey, now);
        return res.status(401).json({ error: 'Invalid email or password', status: 401 });
      }

      clearLoginFailures(rateKey);
      const user = toPublicUser(row);
      const token = signToken(user, { tokenVersion: row.token_version ?? 0 });
      setSessionCookie(res, token);
      return res.status(200).json({ status: 'ok', data: { token, user } });
    } catch (err) {
      return next(err);
    }
  },

  async google(req, res, next) {
    try {
      const idToken = typeof req.body?.id_token === 'string' ? req.body.id_token : '';
      if (!idToken) return res.status(400).json({ error: 'id_token is required', status: 400 });

      let googleUser;
      try {
        googleUser = await verifyGoogleIdToken(idToken);
      } catch (err) {
        if (err.status === 500) return next(err);
        return res.status(401).json({ error: 'Google sign-in could not be verified', status: 401 });
      }

      const byGoogleSub = await UserModel.findByGoogleSub(googleUser.sub);
      const byEmailRow = byGoogleSub ? null : await UserModel.findByEmail(googleUser.email);
      const action = decideGoogleAccountAction({
        byGoogleSub,
        byEmail: byEmailRow ? toPublicUser(byEmailRow) : null,
      });

      if (action === 'login') {
        const tv = (await UserModel.getTokenVersion(byGoogleSub.id)) ?? 0;
        const token = signToken(byGoogleSub, { tokenVersion: tv });
        setSessionCookie(res, token);
        return res.status(200).json({ status: 'ok', data: { token, user: byGoogleSub } });
      }
      if (action === 'link') {
        const user = toPublicUser(byEmailRow);
        await UserModel.linkGoogleSub(user.id, googleUser.sub);
        const token = signToken(user, { tokenVersion: byEmailRow.token_version ?? 0 });
        setSessionCookie(res, token);
        return res.status(200).json({ status: 'ok', data: { token, user } });
      }
      const displayName = (googleUser.name || googleUser.email.split('@')[0]).slice(0, 100);
      const user = await UserModel.createGoogleUser({
        displayName,
        email: googleUser.email,
        googleSub: googleUser.sub,
      });
      const token = signToken(user, { tokenVersion: 0 });
      setSessionCookie(res, token);
      return res.status(201).json({ status: 'ok', data: { token, user } });
    } catch (err) {
      return next(err);
    }
  },

  async logout(_req, res, next) {
    try {
      clearSessionCookie(res);
      return res.status(200).json({ status: 'ok', data: { logged_out: true } });
    } catch (err) {
      return next(err);
    }
  },

  async logoutAll(req, res, next) {
    try {
      const nextVersion = await UserModel.incrementTokenVersion(req.user.id);
      if (nextVersion === null) {
        return res.status(404).json({ error: 'User not found', status: 404 });
      }
      clearSessionCookie(res);
      return res.status(200).json({
        status: 'ok',
        data: { logged_out_all: true, token_version: nextVersion },
      });
    } catch (err) {
      return next(err);
    }
  },

  async me(req, res, next) {
    try {
      const row = await UserModel.findByIdWithCredentials(req.user.id);
      if (!row) return res.status(404).json({ error: 'User not found', status: 404 });

      const rawToken = extractRequestToken(req);
      if (rawToken) {
        try {
          const payload = verifyToken(rawToken);
          if (Number(payload.tv ?? 0) !== Number(row.token_version ?? 0)) {
            clearSessionCookie(res);
            return res.status(401).json({
              error: 'Session has been revoked. Please log in again.',
              status: 401,
            });
          }
        } catch {
          clearSessionCookie(res);
          return res.status(401).json({ error: 'Invalid or expired token.', status: 401 });
        }
      }

      return res.status(200).json({ status: 'ok', data: { user: toPublicUser(row) } });
    } catch (err) {
      return next(err);
    }
  },
};
