/**
 * Phase 3 Security Hardening Tests
 *
 * Covers all 7 Phase 3 security controls:
 * 1. Session token in httpOnly cookie (`pm_session`), accepted by requireAuth
 *    and cleared on logout.
 * 2. Revocation via `users.token_version`: old token dies immediately after
 *    password change or `POST /api/auth/logout-all`.
 * 3. Login rate limit: 10 failed attempts per email+IP per 15 minutes -> 429,
 *    and even the correct password waits while limited.
 * 4. Password policy: minimum 10 characters, at least one letter and one digit
 *    (register + password change).
 * 5. No account-existence leaks: identical error for unknown email and wrong
 *    password + precomputed scrypt dummy hash verification.
 * 6. Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
 *    `Referrer-Policy: no-referrer`) and explicit CORS origin with credentials (never `*`).
 * 7. Password hashing remains scrypt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UserModel,
  hashPassword,
  validatePasswordPolicy,
} from '../src/models/userModel.js';
import {
  SESSION_COOKIE_NAME,
  parseCookies,
  requireAuth,
  verifyToken,
} from '../src/middleware/authMiddleware.js';
import {
  DUMMY_PASSWORD_HASH,
   authController,
  resetLoginRateLimiter,
  validateRegisterInput,
} from '../src/controllers/authController.js';
import { settingsController } from '../src/controllers/settingsController.js';
import {
  REQUIRED_SECURITY_HEADERS,
  buildCorsOptions,
  securityHeaders,
} from '../src/middleware/securityHeaders.js';

const run = Date.now();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  process.env.JWT_SECRET = 'phase3-test-jwt-secret-key-2026';
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const next = (err) => {
  if (err) throw err;
};

test('Phase 3 Control 4: Password policy requires >= 10 chars, >= 1 letter, and >= 1 digit', () => {
  assert.match(validatePasswordPolicy('Short123'), /at least 10 characters/);
  assert.match(validatePasswordPolicy('OnlyLettersHere'), /one letter and one digit/);
  assert.match(validatePasswordPolicy('1234567890'), /one letter and one digit/);
  assert.equal(validatePasswordPolicy('ValidPass10'), null);

  assert.ok(
    validateRegisterInput({
      display_name: 'Test',
      email: 'test@example.com',
      password: 'short1',
    }).error
  );
  assert.equal(
    validateRegisterInput({
      display_name: 'Test',
      email: 'test@example.com',
      password: 'ValidPass10',
    }).error,
    undefined
  );
});

test('Phase 3 Control 6: Security headers and explicit CORS with credentials (never *)', () => {
  const res = mockRes();
  let called = false;
  securityHeaders({}, res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(res.headers['X-Content-Type-Options'], REQUIRED_SECURITY_HEADERS['X-Content-Type-Options']);
  assert.equal(res.headers['X-Frame-Options'], REQUIRED_SECURITY_HEADERS['X-Frame-Options']);
  assert.equal(res.headers['Referrer-Policy'], REQUIRED_SECURITY_HEADERS['Referrer-Policy']);

  const wildcardFallback = buildCorsOptions('*');
  assert.notEqual(wildcardFallback.origin, '*');
  assert.equal(wildcardFallback.credentials, true);

  const explicit = buildCorsOptions('https://promoney.example.com');
  assert.equal(explicit.origin, 'https://promoney.example.com');
  assert.equal(explicit.credentials, true);
});

test('Phase 3 Control 1 & 2: pm_session httpOnly cookie + token_version revocation on password change and logout-all', async () => {
  const email = `revocation+${run}@example.com`;
  const regRes = mockRes();
  await authController.register(
    {
      body: {
        display_name: 'Revocation User',
        email,
        password: 'InitialPass10',
      },
    },
    regRes,
    next
  );
  assert.equal(regRes.statusCode, 201);

  // Verify Set-Cookie has pm_session with HttpOnly and SameSite=Lax
  const setCookieHeader = regRes.headers['Set-Cookie'];
  assert.ok(setCookieHeader, 'Expected Set-Cookie header on register');
  assert.match(setCookieHeader, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(setCookieHeader, /HttpOnly/);
  assert.match(setCookieHeader, /SameSite=Lax/);

  const cookiePair = setCookieHeader.split(';')[0];
  const parsed = parseCookies(cookiePair);
  const tokenV0 = parsed[SESSION_COOKIE_NAME];
  assert.ok(tokenV0);
  assert.equal(verifyToken(tokenV0).tv, 0);

  // Cookie alone authenticates requireAuth (no Authorization header)
  const authReq0 = { headers: { cookie: cookiePair } };
  const authRes0 = mockRes();
  let nextCalled0 = false;
  requireAuth(authReq0, authRes0, () => {
    nextCalled0 = true;
  });
  assert.equal(nextCalled0, true);
  const userId = authReq0.user.id;

  // Reject weak new password on password change (Control 4)
  const weakPwRes = mockRes();
  await settingsController.changePassword(
    {
      user: { id: userId },
      body: { current_password: 'InitialPass10', new_password: 'short1' },
    },
    weakPwRes,
    next
  );
  assert.equal(weakPwRes.statusCode, 400);

  // Valid password change bumps token_version in SQL and revokes old tokenV0 (Control 2)
  const changePwRes = mockRes();
  await settingsController.changePassword(
    {
      user: { id: userId },
      body: { current_password: 'InitialPass10', new_password: 'UpdatedPass20' },
    },
    changePwRes,
    next
  );
  assert.equal(changePwRes.statusCode, 200);
  assert.equal(await UserModel.getTokenVersion(userId), 1);

  // Old tokenV0 now dies in requireAuth (401)
  const revokedReq = { headers: { cookie: cookiePair } };
  const revokedRes = mockRes();
  let revokedNext = false;
  requireAuth(revokedReq, revokedRes, () => {
    revokedNext = true;
  });
  assert.equal(revokedNext, false);
  assert.equal(revokedRes.statusCode, 401);

  // Logging in with the new password issues tokenV1 (tv = 1), which works
  const loginRes = mockRes();
  await authController.login(
    {
      ip: '10.0.0.5',
      body: { email, password: 'UpdatedPass20' },
    },
    loginRes,
    next
  );
  assert.equal(loginRes.statusCode, 200);
  const cookiePairV1 = loginRes.headers['Set-Cookie'].split(';')[0];
  const tokenV1 = parseCookies(cookiePairV1)[SESSION_COOKIE_NAME];
  assert.equal(verifyToken(tokenV1).tv, 1);

  const authReq1 = { headers: { cookie: cookiePairV1 } };
  const authRes1 = mockRes();
  let nextCalled1 = false;
  requireAuth(authReq1, authRes1, () => {
    nextCalled1 = true;
  });
  assert.equal(nextCalled1, true);

  // POST /api/auth/logout-all bumps token_version to 2 and clears cookie; tokenV1 dies
  const logoutAllRes = mockRes();
  await authController.logoutAll({ user: { id: userId } }, logoutAllRes, next);
  assert.equal(logoutAllRes.statusCode, 200);
  assert.equal(logoutAllRes.body.data.token_version, 2);
  assert.match(logoutAllRes.headers['Set-Cookie'], /Max-Age=0/);

  const afterLogoutAllRes = mockRes();
  let afterLogoutAllNext = false;
  requireAuth({ headers: { cookie: cookiePairV1 } }, afterLogoutAllRes, () => {
    afterLogoutAllNext = true;
  });
  assert.equal(afterLogoutAllNext, false);
  assert.equal(afterLogoutAllRes.statusCode, 401);
});

test('Phase 3 Control 3 & 5: No account-existence leaks + 10 failed login attempts -> 429 (even correct password waits)', async () => {
  resetLoginRateLimiter();
  assert.ok(DUMMY_PASSWORD_HASH.startsWith('scrypt$'));

  const email = `ratelimit+${run}@example.com`;
  await UserModel.create({
    displayName: 'Rate Limit User',
    email,
    passwordHash: hashPassword('CorrectPass10'),
  });

  // Control 5: Unknown email and wrong password return the exact same 401 error
  const unknownRes = mockRes();
  await authController.login(
    {
      ip: '192.0.2.10',
      body: { email: `nobody+${run}@example.com`, password: 'WrongPassword10' },
    },
    unknownRes,
    next
  );
  assert.equal(unknownRes.statusCode, 401);

  const wrongRes = mockRes();
  await authController.login(
    {
      ip: '192.0.2.99',
      body: { email, password: 'WrongPassword10' },
    },
    wrongRes,
    next
  );
  assert.equal(wrongRes.statusCode, 401);
  assert.equal(unknownRes.body.error, wrongRes.body.error);

  // Control 3: 10 failed attempts for the same email + IP -> 401, then 11th -> 429
  const baseTime = 1700000000000;
  const clientIp = '203.0.113.42';
  for (let i = 0; i < 10; i += 1) {
    const failRes = mockRes();
    await authController.login(
      {
        ip: clientIp,
        nowOverride: baseTime + i * 1000,
        body: { email, password: 'WrongPassword10' },
      },
      failRes,
      next
    );
    assert.equal(failRes.statusCode, 401);
  }

  // 11th attempt with wrong password -> 429
  const blockedWrongRes = mockRes();
  await authController.login(
    {
      ip: clientIp,
      nowOverride: baseTime + 11000,
      body: { email, password: 'WrongPassword10' },
    },
    blockedWrongRes,
    next
  );
  assert.equal(blockedWrongRes.statusCode, 429);

  // Even the CORRECT password must wait while rate-limited -> 429!
  const blockedCorrectRes = mockRes();
  await authController.login(
    {
      ip: clientIp,
      nowOverride: baseTime + 12000,
      body: { email, password: 'CorrectPass10' },
    },
    blockedCorrectRes,
    next
  );
  assert.equal(blockedCorrectRes.statusCode, 429);

  // After 15 minutes have elapsed, the correct password succeeds (200)
  const afterWindowRes = mockRes();
  await authController.login(
    {
      ip: clientIp,
      nowOverride: baseTime + 15 * 60 * 1000 + 1000,
      body: { email, password: 'CorrectPass10' },
    },
    afterWindowRes,
    next
  );
  assert.equal(afterWindowRes.statusCode, 200);
});
