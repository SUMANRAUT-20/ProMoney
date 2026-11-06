import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Authentication Middleware + JWT (HS256) helpers
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * JWTs are signed/verified with Node's built-in crypto HMAC-SHA256
 * and process.env.JWT_SECRET — no external JWT dependency, and no
 * fallback secret. If JWT_SECRET is missing, signing/verifying
 * throws instead of silently issuing insecure tokens.
 */

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

export function signToken(user, options = {}) {
  const secret = getSecret(options.secret);
  const expiresInSeconds =
    Number(options.expiresInSeconds ?? process.env.JWT_EXPIRES_SECONDS) ||
    DEFAULT_EXPIRES_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: String(user.id),
    email: user.email,
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

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.',
      status: 401,
    });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.', status: 401 });
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: Number(payload.sub), email: payload.email };
    if (!Number.isSafeInteger(req.user.id) || req.user.id <= 0) {
      return res.status(401).json({ error: 'Invalid token.', status: 401 });
    }
    return next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired token. Please log in again.',
      status: 401,
    });
  }
}
