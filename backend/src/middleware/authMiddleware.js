/**
 * Authentication Middleware Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * Does NOT silently bypass authentication with a fake user.
 * In Phase 1, this middleware will verify the signed JWT token and attach req.user.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.',
      status: 401
    });
  }
  return res.status(501).json({
    error: 'Feature not implemented yet. JWT verification will be enabled in Phase 1.',
    status: 501
  });
}
