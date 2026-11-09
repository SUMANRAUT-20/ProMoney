import { UserModel, hashPassword, verifyPassword, toPublicUser } from '../models/userModel.js';
import { SettingsModel, validatePreferences, validateAvatar } from '../models/settingsModel.js';

/**
 * Settings Controller — Arpan Khatiwada (Settings)
 *
 * New endpoints (not yet in docs/INTEGRATION_CONTRACT.md — amendment
 * proposed to Arpan + Suman with this change). All require auth and
 * use snake_case JSON like the rest of the API:
 * - GET /api/settings                -> { profile, preferences }
 * - PUT /api/settings/preferences    { theme?, currency?, date_format? }
 * - PUT /api/settings/profile        { display_name }
 * - PUT /api/settings/avatar         { avatar_data_url } (data:image URL, or null to clear)
 * - PUT /api/settings/password       { current_password, new_password }
 *
 * profile.has_password tells the UI whether a password can be changed
 * at all (Google-only accounts have none). password_hash and
 * google_sub are never returned.
 */

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 100;

function profileOf(row) {
  return {
    ...toPublicUser(row),
    has_password: Boolean(row.password_hash),
  };
}

export const settingsController = {
  async getSettings(req, res, next) {
    try {
      const row = await UserModel.findByIdWithCredentials(req.user.id);
      if (!row) return res.status(404).json({ error: 'User not found', status: 404 });
      const preferences = await SettingsModel.getPreferences(req.user.id);
      const avatarDataUrl = await SettingsModel.getAvatarDataUrl(req.user.id);
      const profile = { ...profileOf(row), avatar_data_url: avatarDataUrl };
      return res.json({ status: 'ok', data: { profile, preferences } });
    } catch (err) {
      return next(err);
    }
  },

  async updatePreferences(req, res, next) {
    try {
      const { preferences, error } = validatePreferences(req.body);
      if (error) return res.status(400).json({ error, status: 400 });
      const saved = await SettingsModel.updatePreferences(req.user.id, preferences);
      return res.json({ status: 'ok', data: { preferences: saved } });
    } catch (err) {
      return next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const displayName = typeof req.body?.display_name === 'string' ? req.body.display_name.trim() : '';
      if (!displayName) {
        return res.status(400).json({ error: 'display_name is required', status: 400 });
      }
      if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
        return res.status(400).json({ error: `display_name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`, status: 400 });
      }
      const user = await UserModel.updateDisplayName(req.user.id, displayName);
      if (!user) return res.status(404).json({ error: 'User not found', status: 404 });
      return res.json({ status: 'ok', data: { user } });
    } catch (err) {
      return next(err);
    }
  },

  async updateAvatar(req, res, next) {
    try {
      const { avatarDataUrl, error } = validateAvatar(req.body);
      if (error) return res.status(400).json({ error, status: 400 });
      const saved = await SettingsModel.setAvatarDataUrl(req.user.id, avatarDataUrl);
      return res.json({ status: 'ok', data: { avatar_data_url: saved } });
    } catch (err) {
      return next(err);
    }
  },

  async changePassword(req, res, next) {
    try {
      const { current_password: currentPassword, new_password: newPassword } = req.body || {};
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'current_password and new_password are required', status: 400 });
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `new_password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`, status: 400 });
      }
      const row = await UserModel.findByIdWithCredentials(req.user.id);
      if (!row) return res.status(404).json({ error: 'User not found', status: 404 });
      if (!row.password_hash) {
        return res.status(400).json({ error: 'This account uses Google sign-in and has no password to change', status: 400 });
      }
      if (!verifyPassword(currentPassword, row.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect', status: 401 });
      }
      await UserModel.updatePasswordHash(req.user.id, hashPassword(newPassword));
      return res.json({ status: 'ok', data: { changed: true } });
    } catch (err) {
      return next(err);
    }
  },
};
