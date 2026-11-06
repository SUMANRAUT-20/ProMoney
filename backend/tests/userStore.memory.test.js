// In-memory user store tests. Since the 2026-11-06 database reset the
// in-memory store is the ONLY store, so no env setup is needed; the
// file still runs in its own process under `node --test`.

import test from 'node:test';
import assert from 'node:assert/strict';

const { UserModel, hashPassword, verifyPassword, getCategoryCount } = await import(
  '../src/models/userModel.js'
);

test('memory store: create seeds the 8 default categories and findByEmail returns the hash', async () => {
  const passwordHash = hashPassword('testpass123');
  const user = await UserModel.create({ displayName: 'Memory User', email: 'memory@example.com', passwordHash });
  assert.equal(user.display_name, 'Memory User');
  assert.equal(await getCategoryCount(user.id), 8);

  const row = await UserModel.findByEmail('memory@example.com');
  assert.equal(row.id, user.id);
  assert.equal(verifyPassword('testpass123', row.password_hash), true);
  assert.equal(verifyPassword('wrong-password', row.password_hash), false);
});

test('memory store: findById returns the public shape (no password_hash)', async () => {
  const user = await UserModel.create({ displayName: 'Second User', email: 'second@example.com', passwordHash: hashPassword('testpass123') });
  const found = await UserModel.findById(user.id);
  assert.deepEqual(found, { id: user.id, display_name: 'Second User', email: 'second@example.com' });
  assert.equal(await UserModel.findById(99999), null);
});

test('memory store: duplicate email is rejected like MySQL (ER_DUP_ENTRY)', async () => {
  await assert.rejects(
    () => UserModel.create({ displayName: 'Copy', email: 'memory@example.com', passwordHash: hashPassword('testpass123') }),
    (err) => err.code === 'ER_DUP_ENTRY'
  );
});

test('memory store: Google create, lookup by google_sub, and linking', async () => {
  const googleUser = await UserModel.createGoogleUser({ displayName: 'Google User', email: 'google@example.com', googleSub: 'sub-123' });
  assert.equal(await getCategoryCount(googleUser.id), 8);
  assert.deepEqual(await UserModel.findByGoogleSub('sub-123'), googleUser);
  assert.equal(await UserModel.findByGoogleSub('unknown-sub'), null);

  const passwordUser = await UserModel.create({ displayName: 'Link Me', email: 'link@example.com', passwordHash: hashPassword('testpass123') });
  await UserModel.linkGoogleSub(passwordUser.id, 'sub-999');
  assert.deepEqual(await UserModel.findByGoogleSub('sub-999'), passwordUser);
});
