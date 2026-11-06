import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * Verifies the signed JWT from the Authorization: Bearer <token> header
 * and attaches req.user = { id, email }. No token or an invalid/expired
 * token is a 401 — there is no silent bypass and no fake user.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.',
      status: 401
    });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      error: 'JWT_SECRET is not configured on the server',
      status: 500
    });
  }
  try {
    const payload = jwt.verify(authHeader.slice('Bearer '.length), secret);
    req.user = { id: Number(payload.sub), email: payload.email };
    return next();
  } catch {
    return res.status(401).json({
      error: 'Invalid or expired token. Please log in again.',
      status: 401
    });
  }
}
