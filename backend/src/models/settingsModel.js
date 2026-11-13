/**
 * User Settings / Preferences Model — IN-MEMORY STORE (no database)
 * Owner: Arpan Khatiwada (Settings)
 *
 * Preferences and profile avatars are stored per user id in a
 * process-memory Map.
 */

const SUPPORTED_THEMES = ['light', 'dark'];
const SUPPORTED_CURRENCIES = ['JPY', 'USD', 'EUR', 'GBP', 'NPR', 'INR', 'AUD', 'CAD'];
const SUPPORTED_DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD MMM YYYY'];

export const DEFAULT_PREFERENCES = {
  theme: 'light',
  currency: 'JPY',
  date_format: 'YYYY-MM-DD',
};

const preferencesByUserId = new Map();
const avatarByUserId = new Map();

// Profile photos are stored as data URLs (the Settings page downscales
// uploads to a small square before sending). Cap the payload so a
// "photo" stays an icon, not a file store: 300k chars ≈ 225 KB image.
export const MAX_AVATAR_DATA_URL_LENGTH = 300000;

export const SettingsModel = {
  /** Returns the user's preferences, merged over the defaults. */
  async getPreferences(userId) {
    return { ...DEFAULT_PREFERENCES, ...(preferencesByUserId.get(Number(userId)) || {}) };
  },

  /** Stores a partial update (already validated) and returns the full result. */
  async updatePreferences(userId, partial) {
    const next = { ...(await SettingsModel.getPreferences(userId)), ...partial };
    preferencesByUserId.set(Number(userId), next);
    return { ...next };
  },

  /** Returns the user's avatar data URL, or null (initials are used). */
  async getAvatarDataUrl(userId) {
    return avatarByUserId.get(Number(userId)) || null;
  },

  /** Sets (string) or clears (null) the user's avatar data URL. */
  async setAvatarDataUrl(userId, dataUrl) {
    if (dataUrl === null) avatarByUserId.delete(Number(userId));
    else avatarByUserId.set(Number(userId), dataUrl);
    return dataUrl;
  },
};

/**
 * Validates an avatar update body (pure — unit-tested).
 * Accepts { avatar_data_url: "data:image/..." } to set, or null to
 * clear. Returns { avatarDataUrl } or { error }.
 */
export function validateAvatar(body) {
  if (!body || typeof body !== 'object' || !('avatar_data_url' in body)) {
    return { error: 'avatar_data_url is required (a data:image URL string, or null to clear)' };
  }
  const value = body.avatar_data_url;
  if (value === null) return { avatarDataUrl: null };
  if (typeof value !== 'string' || !value.startsWith('data:image/')) {
    return { error: 'avatar_data_url must be a data:image URL string, or null to clear' };
  }
  if (value.length > MAX_AVATAR_DATA_URL_LENGTH) {
    return { error: `avatar_data_url is too large (max ${MAX_AVATAR_DATA_URL_LENGTH} characters)` };
  }
  return { avatarDataUrl: value };
}

/**
 * Validates a preferences update body (pure — unit-tested).
 * Returns { preferences } with only the valid provided fields, or
 * { error } naming the first invalid field. Unknown keys are ignored.
 */
export function validatePreferences(body) {
  if (!body || typeof body !== 'object') return { error: 'a JSON object body is required' };
  const preferences = {};
  if (body.theme !== undefined) {
    if (!SUPPORTED_THEMES.includes(body.theme)) {
      return { error: `theme must be one of: ${SUPPORTED_THEMES.join(', ')}` };
    }
    preferences.theme = body.theme;
  }
  if (body.currency !== undefined) {
    if (!SUPPORTED_CURRENCIES.includes(body.currency)) {
      return { error: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}` };
    }
    preferences.currency = body.currency;
  }
  if (body.date_format !== undefined) {
    if (!SUPPORTED_DATE_FORMATS.includes(body.date_format)) {
      return { error: `date_format must be one of: ${SUPPORTED_DATE_FORMATS.join(', ')}` };
    }
    preferences.date_format = body.date_format;
  }
  if (Object.keys(preferences).length === 0) {
    return { error: 'at least one of theme, currency, date_format is required' };
  }
  return { preferences };
}
