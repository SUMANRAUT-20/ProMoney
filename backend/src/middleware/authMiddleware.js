import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCachedTokenVersion } from '../models/userModel.js';

/**
 * Authentication Middleware + JWT (HS256) + httpOnly Cookie (`pm_session`)
 * Joint Owners: Arpan Khatiwada & Suman Raut (Phase 3 Security Hardening)
 *
 * - Session tokens are issued in an httpOnly cookie (`pm_session`).
 * - JWTs carry `tv` (token_version); bumping `users.token_version` on
 *   password change or logout-all immediately revokes older tokens.
 * - `requireAuth` reads `pm_session` from `Cookie` (or `Authorization: Bearer`
 *   for API/test callers) and verifies signature, expiry, and `token_version`.
 */

export const SESSION_COOKIE_NAME = 'pm_session';
const DEFAULT_EXPIRES_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(secretOverride) {
  const secret = secretOverride ?? process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('JWT_SECRET must be set to a string of at least 16 characters');
  }
  return secret;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function setSessionCookie(res, token, options = {}) {
  if (!res || typeof res.setHeader !== 'function') return;
  const maxAge =
    Number(options.expiresInSeconds ?? process.env.JWT_EXPIRES_SECONDS) ||
    DEFAULT_EXPIRES_SECONDS;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  if (!res || typeof res.setHeader !== 'function') return;
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function signToken(user, options = {}) {
  const secret = getSecret(options.secret);
  const expiresInSeconds =
    Number(options.expiresInSeconds ?? process.env.JWT_EXPIRES_SECONDS) ||
    DEFAULT_EXPIRES_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenVersion = Number(
    options.tokenVersion ??
      user.token_version ??
      getCachedTokenVersion(user.id) ??
      0
  );
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: String(user.id),
    email: user.email,
    tv: tokenVersion,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token, options = {}) {
  const secret = getSecret(options.secret);
  if (typeof token !== 'string') throw new Error('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const given = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new Error('Invalid token signature');
  }

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid token');
  }
  if (header.alg !== 'HS256') throw new Error('Invalid token algorithm');
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSeconds) throw new Error('Token expired');
  if (!payload.sub) throw new Error('Invalid token payload');
  return payload;
}

export function extractRequestToken(req) {
  const cookies = parseCookies(req?.headers?.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  const authHeader = req?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice('Bearer '.length).trim();
    if (bearer) return bearer;
  }
  return null;
}

export function requireAuth(req, res, next) {
  const token = extractRequestToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please log in.',
      status: 401,
    });
  }
  try {
    const payload = verifyToken(token);
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: 'Invalid token.', status: 401 });
    }
    const currentTv = getCachedTokenVersion(userId);
    if (currentTv !== undefined && Number(payload.tv ?? 0) !== currentTv) {
      return res.status(401).json({
        error: 'Session has been revoked. Please log in again.',
        status: 401,
      });
    }
    req.user = { id: userId, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired token. Please log in again.',
      status: 401,
    });
  }
}
