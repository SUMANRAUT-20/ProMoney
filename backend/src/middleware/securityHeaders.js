/**
 * Security Headers & Explicit CORS Helper (Phase 3 Rule 6)
 *
 * Sets mandatory defensive headers on API responses:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: no-referrer
 */

export const REQUIRED_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

export function securityHeaders(_req, res, next) {
  for (const [header, value] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    res.setHeader(header, value);
  }
  next();
}

export function buildCorsOptions(originEnv = process.env.CLIENT_ORIGIN) {
  const explicitOrigin =
    originEnv && originEnv.trim() && originEnv.trim() !== '*'
      ? originEnv.trim()
      : 'http://localhost:5173';
  return {
    origin: explicitOrigin,
    credentials: true,
  };
}
