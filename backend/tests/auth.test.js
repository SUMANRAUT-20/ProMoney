import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword, DEFAULT_CATEGORIES } from '../src/models/userModel.js';
import { signToken, verifyToken, requireAuth } from '../src/middleware/authMiddleware.js';

const TEST_SECRET = 'test-secret-at-least-16-chars';
const TEST_USER = { id: 42, email: 'arpan@example.com' };

// --- Password hashing (scrypt) ---

test('hashPassword does not store the plain password and verifies correctly', () => {
  const hash = hashPassword('StrongPassword123');
  assert.ok(hash.startsWith('scrypt$'));
  assert.ok(!hash.includes('StrongPassword123'));
  assert.equal(verifyPassword('StrongPassword123', hash), true);
});

test('verifyPassword rejects a wrong password', () => {
  const hash = hashPassword('StrongPassword123');
  assert.equal(verifyPassword('WrongPassword123', hash), false);
});

test('hashPassword uses a random salt (same password, different hashes)', () => {
  assert.notEqual(hashPassword('StrongPassword123'), hashPassword('StrongPassword123'));
});

test('verifyPassword returns false for malformed hashes instead of throwing', () => {
  assert.equal(verifyPassword('whatever', 'not-a-hash'), false);
  assert.equal(verifyPassword('whatever', ''), false);
  assert.equal(verifyPassword('whatever', null), false);
});

test('default categories match the seeds.sql template (2 income, 6 expense)', () => {
  assert.equal(DEFAULT_CATEGORIES.filter((c) => c.kind === 'income').length, 2);
  assert.equal(DEFAULT_CATEGORIES.filter((c) => c.kind === 'expense').length, 6);
});

// --- JWT signing / verification (HMAC-SHA256) ---

test('signToken / verifyToken round-trip returns the user id and email', () => {
  const token = signToken(TEST_USER, { secret: TEST_SECRET });
  assert.equal(token.split('.').length, 3);
  const payload = verifyToken(token, { secret: TEST_SECRET });
  assert.equal(payload.sub, '42');
  assert.equal(payload.email, 'arpan@example.com');
  assert.ok(payload.exp > payload.iat);
});

test('verifyToken rejects a tampered payload', () => {
  const token = signToken(TEST_USER, { secret: TEST_SECRET });
  const [header, , signature] = token.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ sub: '999', email: 'attacker@example.com', iat: 1, exp: 9999999999 })
  ).toString('base64url');
  assert.throws(() => verifyToken(`${header}.${forgedPayload}.${signature}`, { secret: TEST_SECRET }));
});

test('verifyToken rejects a token signed with a different secret', () => {
  const token = signToken(TEST_USER, { secret: TEST_SECRET });
  assert.throws(() => verifyToken(token, { secret: 'a-completely-different-secret' }));
});

test('verifyToken rejects expired and malformed tokens', () => {
  const expired = signToken(TEST_USER, { secret: TEST_SECRET, expiresInSeconds: -10 });
  assert.throws(() => verifyToken(expired, { secret: TEST_SECRET }), /expired/i);
  assert.throws(() => verifyToken('not-a-token', { secret: TEST_SECRET }));
  assert.throws(() => verifyToken('', { secret: TEST_SECRET }));
});

test('signToken refuses to run without a proper JWT_SECRET', () => {
  assert.throws(() => signToken(TEST_USER, { secret: 'short' }), /JWT_SECRET/);
});

// --- requireAuth middleware ---

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('requireAuth returns 401 when the Authorization header is missing', () => {
  const req = { headers: {} };
  const res = mockRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('requireAuth returns 401 for an invalid token (no fake user is attached)', () => {
  const req = { headers: { authorization: 'Bearer invalid.token.here' } };
  const res = mockRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(req.user, undefined);
});

test('requireAuth attaches req.user and calls next() for a valid token', () => {
  process.env.JWT_SECRET = TEST_SECRET;
  try {
    const token = signToken(TEST_USER);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.deepEqual(req.user, { id: 42, email: 'arpan@example.com' });
  } finally {
    delete process.env.JWT_SECRET;
  }
});
