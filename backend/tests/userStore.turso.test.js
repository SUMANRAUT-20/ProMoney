// Turso (libSQL) auth store tests — AUTH_STORE=turso.
// Runs against a REAL libSQL engine in local in-memory mode
// (TURSO_DATABASE_URL=":memory:"), so the SQL, schema creation, and
// constraint behaviour are genuinely exercised without needing
// Arpan's cloud database or its secret token. Runs in its own
// process under `node --test`, like the memory-store tests.
process.env.AUTH_STORE = 'turso';
process.env.TURSO_DATABASE_URL = ':memory:';
delete process.env.TURSO_AUTH_TOKEN;

import test from 'node:test';
import assert from 'node:assert/strict';

const { UserModel, hashPassword, verifyPassword, getCategoryCount } = await import(
  '../src/models/userModel.js'
);

test('turso store: create seeds the 8 default categories and findByEmail returns the hash', async () => {
  const passwordHash = hashPassword('testpass123');
  const user = await UserModel.create({ displayName: 'Turso User', email: 'turso@example.com', passwordHash });
  assert.equal(user.display_name, 'Turso User');
  assert.equal(await getCategoryCount(user.id), 8);

  const row = await UserModel.findByEmail('turso@example.com');
  assert.equal(row.id, user.id);
  assert.equal(verifyPassword('testpass123', row.password_hash), true);
  assert.equal(verifyPassword('wrong-password', row.password_hash), false);
});

test('turso store: findById returns the public shape (no password_hash)', async () => {
  const user = await UserModel.create({ displayName: 'Second Turso', email: 'second.turso@example.com', passwordHash: hashPassword('testpass123') });
  const found = await UserModel.findById(user.id);
  assert.deepEqual(found, { id: user.id, display_name: 'Second Turso', email: 'second.turso@example.com' });
  assert.equal(await UserModel.findById(99999), null);
});

test('turso store: duplicate email is rejected like MySQL (ER_DUP_ENTRY)', async () => {
  await assert.rejects(
    () => UserModel.create({ displayName: 'Copy', email: 'turso@example.com', passwordHash: hashPassword('testpass123') }),
    (err) => err.code === 'ER_DUP_ENTRY'
  );
});

test('turso store: Google create, lookup by google_sub, and linking', async () => {
  const googleUser = await UserModel.createGoogleUser({ displayName: 'Turso Google', email: 'turso.google@example.com', googleSub: 'tsub-123' });
  assert.equal(await getCategoryCount(googleUser.id), 8);
  assert.deepEqual(await UserModel.findByGoogleSub('tsub-123'), googleUser);
  assert.equal(await UserModel.findByGoogleSub('unknown-sub'), null);

  const passwordUser = await UserModel.create({ displayName: 'Turso Link', email: 'turso.link@example.com', passwordHash: hashPassword('testpass123') });
  await UserModel.linkGoogleSub(passwordUser.id, 'tsub-999');
  assert.deepEqual(await UserModel.findByGoogleSub('tsub-999'), passwordUser);
});
