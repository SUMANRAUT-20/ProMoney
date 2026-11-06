import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/userModel.js';

/**
 * Auth Controller
 * Joint Owners: Arpan Khatiwada & Suman Raut (Coordinated with Renuka Karmacharya)
 *
 * Uses snake_case JSON fields per docs/INTEGRATION_CONTRACT.md.
 * Passwords are stored ONLY as bcrypt hashes. Login returns a signed JWT;
 * the frontend keeps it in localStorage as pm_auth_token (see services/api.js).
 */

const TOKEN_TTL = '7d';
// Compared against when the email is unknown, so login timing does not
// reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured on the server');
  return jwt.sign({ email: user.email }, secret, {
    subject: String(user.id),
    expiresIn: TOKEN_TTL
  });
}

function publicUser(user) {
  return { id: user.id, display_name: user.displayName ?? user.display_name, email: user.email };
}

export const authController = {
  async register(req, res, next) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const display_name = String(req.body?.display_name || '').trim();
      if (!email || !password || !display_name) {
        return res.status(400).json({
          error: 'display_name, email, and password are required',
          status: 400
        });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'email is not valid', status: 400 });
      }
      if (password.length < 8) {
        return res.status(400).json({
          error: 'password must be at least 8 characters',
          status: 400
        });
      }
      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(409).json({
          error: 'An account with this email already exists',
          status: 409
        });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await UserModel.create({ displayName: display_name, email, passwordHash });
      return res.status(201).json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) {
        return res.status(400).json({
          error: 'email and password are required',
          status: 400
        });
      }
      const user = await UserModel.findByEmail(email);
      const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok) {
        return res.status(401).json({
          error: 'Invalid email or password',
          status: 401
        });
      }
      return res.json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await UserModel.findByEmail(req.user.email);
      if (!user) {
        return res.status(401).json({ error: 'Account no longer exists', status: 401 });
      }
      return res.json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  }
};
