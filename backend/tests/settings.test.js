// Settings tests — preferences validation/model + controller flows
// (profile rename, password change). Users live in the DATABASE store
// (Step 2), so test emails/google_sub get a per-run suffix: database
// rows persist between runs, the old in-memory store did not.
import test from 'node:test';
import assert from 'node:assert/strict';

import { SettingsModel, validatePreferences, DEFAULT_PREFERENCES } from '../src/models/settingsModel.js';
import { UserModel, hashPassword, verifyPassword } from '../src/models/userModel.js';
import { settingsController } from '../src/controllers/settingsController.js';

const run = Date.now();

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
const next = (err) => { if (err) throw err; };

// --- validatePreferences (pure) ---

test('validatePreferences accepts valid partial updates and ignores unknown keys', () => {
  const { preferences, error } = validatePreferences({ currency: 'NPR', theme: 'dark', bogus: 1 });
  assert.equal(error, undefined);
  assert.deepEqual(preferences, { currency: 'NPR', theme: 'dark' });
});

test('validatePreferences rejects bad enum values and empty bodies', () => {
  assert.match(validatePreferences({ theme: 'blue' }).error, /theme must be one of/);
  assert.match(validatePreferences({ currency: 'XXX' }).error, /currency must be one of/);
  assert.match(validatePreferences({ date_format: 'MM-DD-YY' }).error, /date_format must be one of/);
  assert.match(validatePreferences({}).error, /at least one of/);
  assert.match(validatePreferences(null).error, /JSON object/);
});

test('validatePreferences accepts the expanded currency list', () => {
  for (const code of ['KRW', 'THB', 'SGD', 'AED', 'BRL', 'PLN']) {
    assert.deepEqual(validatePreferences({ currency: code }).preferences, { currency: code });
  }
});

test('validatePreferences accepts the bilingual UI languages and rejects others', () => {
  assert.deepEqual(validatePreferences({ language: 'ja' }).preferences, { language: 'ja' });
  assert.deepEqual(validatePreferences({ language: 'en' }).preferences, { language: 'en' });
  assert.match(validatePreferences({ language: 'fr' }).error, /language must be one of/);
});

// --- SettingsModel ---

test('settings model: defaults, partial merge, and per-user isolation', async () => {
  assert.deepEqual(await SettingsModel.getPreferences(101), DEFAULT_PREFERENCES);
  const saved = await SettingsModel.updatePreferences(101, { currency: 'USD' });
  assert.deepEqual(saved, { ...DEFAULT_PREFERENCES, currency: 'USD' });
  assert.deepEqual(await SettingsModel.getPreferences(101), saved);
  assert.deepEqual(await SettingsModel.getPreferences(202), DEFAULT_PREFERENCES);
});

test('settings model: language defaults to en and persists per user', async () => {
  assert.equal((await SettingsModel.getPreferences(303)).language, 'en');
  const saved = await SettingsModel.updatePreferences(303, { language: 'ja' });
  assert.equal(saved.language, 'ja');
  assert.equal((await SettingsModel.getPreferences(303)).language, 'ja');
  assert.equal((await SettingsModel.getPreferences(404)).language, 'en');
});

// --- Controller flows ---

test('settings controller: GET returns profile with has_password and default preferences', async () => {
  const user = await UserModel.create({ displayName: 'Settings User', email: `settings+${run}@example.com`, passwordHash: hashPassword('testpass123') });
  const res = mockRes();
  await settingsController.getSettings({ user: { id: user.id } }, res, next);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.profile.display_name, 'Settings User');
  assert.equal(res.body.data.profile.has_password, true);
  assert.equal(res.body.data.profile.password_hash, undefined);
  assert.deepEqual(res.body.data.preferences, DEFAULT_PREFERENCES);
});

test('settings controller: preferences update persists; invalid value is a 400', async () => {
  const user = await UserModel.create({ displayName: 'Prefs User', email: `prefs+${run}@example.com`, passwordHash: hashPassword('testpass123') });
  const okRes = mockRes();
  await settingsController.updatePreferences({ user: { id: user.id }, body: { date_format: 'DD/MM/YYYY' } }, okRes, next);
  assert.equal(okRes.statusCode, 200);
  assert.equal(okRes.body.data.preferences.date_format, 'DD/MM/YYYY');

  const badRes = mockRes();
  await settingsController.updatePreferences({ user: { id: user.id }, body: { theme: 'neon' } }, badRes, next);
  assert.equal(badRes.statusCode, 400);
});

test('settings controller: profile rename validates and updates', async () => {
  const user = await UserModel.create({ displayName: 'Old Name', email: `rename+${run}@example.com`, passwordHash: hashPassword('testpass123') });
  const res = mockRes();
  await settingsController.updateProfile({ user: { id: user.id }, body: { display_name: '  New Name  ' } }, res, next);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.display_name, 'New Name');
  assert.equal((await UserModel.findById(user.id)).display_name, 'New Name');

  const badRes = mockRes();
  await settingsController.updateProfile({ user: { id: user.id }, body: { display_name: '   ' } }, badRes, next);
  assert.equal(badRes.statusCode, 400);
});

test('settings controller: password change checks current password and updates the hash', async () => {
  const user = await UserModel.create({ displayName: 'Pass User', email: `pass+${run}@example.com`, passwordHash: hashPassword('old-password-1') });

  const wrongRes = mockRes();
  await settingsController.changePassword(
    { user: { id: user.id }, body: { current_password: 'not-the-password', new_password: 'new-password-2' } },
    wrongRes, next
  );
  assert.equal(wrongRes.statusCode, 401);

  const okRes = mockRes();
  await settingsController.changePassword(
    { user: { id: user.id }, body: { current_password: 'old-password-1', new_password: 'new-password-2' } },
    okRes, next
  );
  assert.equal(okRes.statusCode, 200);
  const row = await UserModel.findByEmail(`pass+${run}@example.com`);
  assert.equal(verifyPassword('new-password-2', row.password_hash), true);
  assert.equal(verifyPassword('old-password-1', row.password_hash), false);
});

test('settings controller: Google-only account cannot change a password it does not have', async () => {
  const user = await UserModel.createGoogleUser({ displayName: 'Google User', email: `guser+${run}@example.com`, googleSub: `sub-settings-${run}` });
  const res = mockRes();
  await settingsController.changePassword(
    { user: { id: user.id }, body: { current_password: 'whatever123', new_password: 'new-password-2' } },
    res, next
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Google sign-in/);
});

test('validateAvatar accepts a data:image URL and null, rejects junk and oversize', async () => {
  const { validateAvatar, MAX_AVATAR_DATA_URL_LENGTH } = await import('../src/models/settingsModel.js');
  assert.deepEqual(validateAvatar({ avatar_data_url: null }), { avatarDataUrl: null });
  const ok = validateAvatar({ avatar_data_url: 'data:image/png;base64,iVBORw0KGgo=' });
  assert.equal(ok.avatarDataUrl, 'data:image/png;base64,iVBORw0KGgo=');
  assert.match(validateAvatar({}).error, /avatar_data_url is required/);
  assert.match(validateAvatar({ avatar_data_url: 'https://example.com/a.png' }).error, /data:image/);
  assert.match(
    validateAvatar({ avatar_data_url: 'data:image/png;base64,' + 'A'.repeat(MAX_AVATAR_DATA_URL_LENGTH) }).error,
    /too large/
  );
});

test('settings controller: avatar set, returned by GET settings, and cleared', async () => {
  const user = await UserModel.create({ displayName: 'Avatar User', email: `avatar+${run}@example.com`, passwordHash: hashPassword('testpass123') });
  const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  const setRes = mockRes();
  await settingsController.updateAvatar({ user: { id: user.id }, body: { avatar_data_url: dataUrl } }, setRes, next);
  assert.equal(setRes.statusCode, 200);
  assert.equal(setRes.body.data.avatar_data_url, dataUrl);

  const getRes = mockRes();
  await settingsController.getSettings({ user: { id: user.id } }, getRes, next);
  assert.equal(getRes.body.data.profile.avatar_data_url, dataUrl);

  const badRes = mockRes();
  await settingsController.updateAvatar({ user: { id: user.id }, body: { avatar_data_url: 'not-a-data-url' } }, badRes, next);
  assert.equal(badRes.statusCode, 400);

  const clearRes = mockRes();
  await settingsController.updateAvatar({ user: { id: user.id }, body: { avatar_data_url: null } }, clearRes, next);
  assert.equal(clearRes.statusCode, 200);
  assert.equal(clearRes.body.data.avatar_data_url, null);
});
