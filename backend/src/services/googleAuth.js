import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

/**
 * Google ID-token verification — Phase 1 Google Sign-In (Arpan Khatiwada)
 *
 * Verifies a Google Identity Services ID token (a JWT signed RS256 by
 * Google) WITHOUT any external dependency:
 * 1. Reads the token header `kid` and finds that key in Google's JWKS
 *    (https://www.googleapis.com/oauth2/v3/certs, cached for 1 hour).
 * 2. Verifies the RS256 signature with Node crypto.
 * 3. Checks the claims every relying party must check:
 *    iss is Google, aud is OUR client id, exp is in the future,
 *    email is present and email_verified is true, sub is present.
 *
 * The JWKS fetcher is injectable (`getJwks`) so unit tests can verify
 * real RS256 signatures against a locally generated key pair without
 * calling Google.
 */

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const JWKS_CACHE_MS = 60 * 60 * 1000;

let jwksCache = { fetchedAt: 0, jwks: null };

export async function fetchGoogleJwks() {
  const now = Date.now();
  if (jwksCache.jwks && now - jwksCache.fetchedAt < JWKS_CACHE_MS) {
    return jwksCache.jwks;
  }
  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) throw new Error('Could not fetch Google signing keys');
  const jwks = await response.json();
  jwksCache = { fetchedAt: now, jwks };
  return jwks;
}

function decodeJsonPart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/**
 * @param {string} idToken  The credential returned by Google Identity Services.
 * @param {{ clientId?: string, getJwks?: () => Promise<{keys: object[]}> }} options
 * @returns {Promise<{ sub: string, email: string, name: string|null, picture: string|null }>}
 * @throws {Error} with a `status` of 401 for an invalid token, 500 for missing config.
 */
export async function verifyGoogleIdToken(idToken, options = {}) {
  const clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const err = new Error('Google sign-in is not configured on the server (GOOGLE_CLIENT_ID is missing)');
    err.status = 500;
    throw err;
  }
  const invalid = (message) => {
    const err = new Error(message);
    err.status = 401;
    return err;
  };

  if (typeof idToken !== 'string' || !idToken) throw invalid('id_token is required');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw invalid('Invalid Google token');

  let header;
  let payload;
  try {
    header = decodeJsonPart(parts[0]);
    payload = decodeJsonPart(parts[1]);
  } catch {
    throw invalid('Invalid Google token');
  }
  if (header.alg !== 'RS256' || !header.kid) throw invalid('Invalid Google token header');

  const getJwks = options.getJwks || fetchGoogleJwks;
  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find((key) => key.kid === header.kid);
  if (!jwk) throw invalid('Unknown Google signing key');

  let signatureValid = false;
  try {
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    signatureValid = cryptoVerify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      publicKey,
      Buffer.from(parts[2], 'base64url')
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) throw invalid('Invalid Google token signature');

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISSUERS.includes(payload.iss)) throw invalid('Invalid Google token issuer');
  if (payload.aud !== clientId) throw invalid('Google token was issued for a different app');
  if (!payload.exp || payload.exp <= nowSeconds) throw invalid('Google token has expired');
  if (!payload.sub) throw invalid('Google token has no subject');
  if (!payload.email) throw invalid('Google token has no email');
  // Google returns email_verified as boolean true or the string "true".
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw invalid('Google email is not verified');
  }

  return {
    sub: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name : null,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  };
}
