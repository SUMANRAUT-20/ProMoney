import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';

import { verifyGoogleIdToken } from '../src/services/googleAuth.js';
import { decideGoogleAccountAction } from '../src/controllers/authController.js';

// Real RS256 test keys, generated locally — the same algorithm Google
// uses, so signature verification is genuinely exercised (no mocks of
// the crypto itself). Only the JWKS *fetch* is replaced, with a JWKS
// containing this test key, exactly like Google's certs endpoint.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const TEST_JWK = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key-1', alg: 'RS256', use: 'sig' };
const getJwks = async () => ({ keys: [TEST_JWK] });
const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeGoogleToken(payloadOverrides = {}, headerOverrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key-1', ...headerOverrides };
  const payload = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-user-123',
    email: 'arpan@example.com',
    email_verified: true,
    name: 'Arpan Khatiwada',
    iat: now,
    exp: now + 3600,
    ...payloadOverrides,
  };
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
  return `${unsigned}.${signature}`;
}

test('verifyGoogleIdToken accepts a correctly signed Google-style token', async () => {
  const result = await verifyGoogleIdToken(makeGoogleToken(), { clientId: CLIENT_ID, getJwks });
  assert.deepEqual(result, {
    sub: 'google-user-123',
    email: 'arpan@example.com',
    name: 'Arpan Khatiwada',
    picture: null,
  });
});

test('verifyGoogleIdToken rejects a tampered payload', async () => {
  const [header, , signature] = makeGoogleToken().split('.');
  const forged = Buffer.from(
    JSON.stringify({ iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'attacker', email: 'evil@example.com', email_verified: true, exp: 9999999999 })
  ).toString('base64url');
  await assert.rejects(() => verifyGoogleIdToken(`${header}.${forged}.${signature}`, { clientId: CLIENT_ID, getJwks }), /signature/i);
});

test('verifyGoogleIdToken rejects wrong audience, issuer, and expired tokens', async () => {
  await assert.rejects(() => verifyGoogleIdToken(makeGoogleToken({ aud: 'someone-elses-client' }), { clientId: CLIENT_ID, getJwks }), /different app/i);
  await assert.rejects(() => verifyGoogleIdToken(makeGoogleToken({ iss: 'https://evil.example.com' }), { clientId: CLIENT_ID, getJwks }), /issuer/i);
  await assert.rejects(() => verifyGoogleIdToken(makeGoogleToken({ exp: Math.floor(Date.now() / 1000) - 60 }), { clientId: CLIENT_ID, getJwks }), /expired/i);
});

test('verifyGoogleIdToken rejects unverified email and unknown signing keys', async () => {
  await assert.rejects(() => verifyGoogleIdToken(makeGoogleToken({ email_verified: false }), { clientId: CLIENT_ID, getJwks }), /not verified/i);
  await assert.rejects(() => verifyGoogleIdToken(makeGoogleToken({}, { kid: 'unknown-key' }), { clientId: CLIENT_ID, getJwks }), /signing key/i);
});

test('verifyGoogleIdToken fails as a server error (500) when GOOGLE_CLIENT_ID is not configured', async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    await assert.rejects(
      () => verifyGoogleIdToken(makeGoogleToken(), { getJwks }),
      (err) => err.status === 500 && /GOOGLE_CLIENT_ID/.test(err.message)
    );
  } finally {
    if (saved !== undefined) process.env.GOOGLE_CLIENT_ID = saved;
  }
});

// --- Provisioning / account linking decisions ---

test('decideGoogleAccountAction: linked Google identity logs in', () => {
  assert.equal(
    decideGoogleAccountAction({ byGoogleSub: { id: 1 }, byEmail: { id: 1 } }),
    'login'
  );
});

test('decideGoogleAccountAction: existing password account with same email is linked', () => {
  assert.equal(
    decideGoogleAccountAction({ byGoogleSub: null, byEmail: { id: 2 } }),
    'link'
  );
});

test('decideGoogleAccountAction: brand-new Google user creates an account', () => {
  assert.equal(
    decideGoogleAccountAction({ byGoogleSub: null, byEmail: null }),
    'create'
  );
});
