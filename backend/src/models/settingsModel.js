import { getDbPool } from '../db.js';

/**
 * User Settings / Preferences Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Owner: Arpan Khatiwada & Suman Raut (Phase 2 Step 2c)
 *
 * Preferences (including Home set-once settings) and profile avatars are
 * persisted per user in the SQL `user_settings` table so they survive
 * server restarts.
 */

const SUPPORTED_THEMES = ['light', 'dark'];
const SUPPORTED_CURRENCIES = ['JPY', 'USD', 'EUR', 'GBP', 'NPR', 'INR', 'AUD', 'CAD'];
const SUPPORTED_DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD MMM YYYY'];

export const DEFAULT_WARNING_SWITCHES = {
  budget: true,
  pace: true,
  bills: true,
  goals: true,
};

export const DEFAULT_PREFERENCES = {
  theme: 'light',
  currency: 'JPY',
  date_format: 'YYYY-MM-DD',
  budget_warning_percent: 20,
  minimum_buffer: 0,
  bill_reminder_days: 3,
  payday_day: 25,
  expected_monthly_income: null,
  card_schedules: {},
  warning_switches: { ...DEFAULT_WARNING_SWITCHES },
};

// Profile photos are stored as data URLs (the Settings page downscales
// uploads to a small square before sending). Cap the payload so a
// "photo" stays an icon, not a file store: 300k chars ≈ 225 KB image.
export const MAX_AVATAR_DATA_URL_LENGTH = 300000;

const pool = getDbPool();

function parsePrefsJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function mergeWithDefaults(stored) {
  const merged = {
    ...DEFAULT_PREFERENCES,
    ...stored,
    card_schedules: {
      ...DEFAULT_PREFERENCES.card_schedules,
      ...(stored?.card_schedules && typeof stored.card_schedules === 'object' ? stored.card_schedules : {}),
    },
    warning_switches: {
      ...DEFAULT_WARNING_SWITCHES,
      ...(stored?.warning_switches && typeof stored.warning_switches === 'object' ? stored.warning_switches : {}),
    },
  };
  return merged;
}

export const SettingsModel = {
  /** Returns the user's preferences from SQL, merged over the defaults. */
  async getPreferences(userId) {
    const [rows] = await pool.execute(
      'SELECT preferences_json FROM user_settings WHERE user_id = ?',
      [Number(userId)]
    );
    const stored = rows[0] ? parsePrefsJson(rows[0].preferences_json) : {};
    return mergeWithDefaults(stored);
  },

  /** Stores a partial update in SQL and returns the full merged preferences. */
  async updatePreferences(userId, partial) {
    const current = await SettingsModel.getPreferences(userId);
    const next = mergeWithDefaults({
      ...current,
      ...partial,
      ...(partial.card_schedules
        ? { card_schedules: { ...current.card_schedules, ...partial.card_schedules } }
        : {}),
      ...(partial.warning_switches
        ? { warning_switches: { ...current.warning_switches, ...partial.warning_switches } }
        : {}),
    });
    const jsonStr = JSON.stringify(next);
    await pool.execute(
      `INSERT INTO user_settings (user_id, preferences_json)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE preferences_json = VALUES(preferences_json)`,
      [Number(userId), jsonStr]
    );
    return next;
  },

  /** Returns the user's avatar data URL from SQL, or null (initials are used). */
  async getAvatarDataUrl(userId) {
    const [rows] = await pool.execute(
      'SELECT avatar_data_url FROM user_settings WHERE user_id = ?',
      [Number(userId)]
    );
    return rows[0]?.avatar_data_url || null;
  },

  /** Sets (string) or clears (null) the user's avatar data URL in SQL. */
  async setAvatarDataUrl(userId, dataUrl) {
    const defaultJson = JSON.stringify(DEFAULT_PREFERENCES);
    await pool.execute(
      `INSERT INTO user_settings (user_id, preferences_json, avatar_data_url)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE avatar_data_url = VALUES(avatar_data_url)`,
      [Number(userId), defaultJson, dataUrl]
    );
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
 * Supports workspace preferences (theme, currency, date_format) as well
 * as Home set-once settings (budget_warning_percent, minimum_buffer,
 * bill_reminder_days, payday_day, expected_monthly_income,
 * card_schedules, warning_switches).
 * Returns { preferences } with only the valid provided fields, or
 * { error } naming the first invalid field. Unknown keys are ignored.
 */
export function validatePreferences(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'a JSON object body is required' };
  }
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

  if (body.budget_warning_percent !== undefined) {
    const val = Number(body.budget_warning_percent);
    if (!Number.isInteger(val) || val < 1 || val > 100) {
      return { error: 'budget_warning_percent must be an integer between 1 and 100' };
    }
    preferences.budget_warning_percent = val;
  }

  if (body.minimum_buffer !== undefined) {
    const val = Number(body.minimum_buffer);
    if (!Number.isSafeInteger(val) || val < 0) {
      return { error: 'minimum_buffer must be a non-negative integer JPY amount' };
    }
    preferences.minimum_buffer = val;
  }

  if (body.bill_reminder_days !== undefined) {
    const val = Number(body.bill_reminder_days);
    if (!Number.isInteger(val) || val < 0 || val > 30) {
      return { error: 'bill_reminder_days must be an integer between 0 and 30' };
    }
    preferences.bill_reminder_days = val;
  }

  if (body.payday_day !== undefined) {
    if (body.payday_day === null) {
      preferences.payday_day = null;
    } else {
      const val = Number(body.payday_day);
      if (!Number.isInteger(val) || val < 1 || val > 31) {
        return { error: 'payday_day must be an integer between 1 and 31, or null' };
      }
      preferences.payday_day = val;
    }
  }

  if (body.expected_monthly_income !== undefined) {
    if (body.expected_monthly_income === null) {
      preferences.expected_monthly_income = null;
    } else {
      const val = Number(body.expected_monthly_income);
      if (!Number.isSafeInteger(val) || val < 0) {
        return { error: 'expected_monthly_income must be a non-negative integer JPY amount, or null' };
      }
      preferences.expected_monthly_income = val;
    }
  }

  if (body.card_schedules !== undefined) {
    if (!body.card_schedules || typeof body.card_schedules !== 'object' || Array.isArray(body.card_schedules)) {
      return { error: 'card_schedules must be an object mapping card account IDs to { closing_day, payment_day }' };
    }
    const cleanSchedules = {};
    for (const [cardId, sched] of Object.entries(body.card_schedules)) {
      if (!sched || typeof sched !== 'object') {
        return { error: `card_schedules[${cardId}] must be an object` };
      }
      const closingDay = Number(sched.closing_day);
      const paymentDay = Number(sched.payment_day);
      if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 ||
          !Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
        return { error: 'card_schedules closing_day and payment_day must be integers between 1 and 31' };
      }
      cleanSchedules[cardId] = { closing_day: closingDay, payment_day: paymentDay };
    }
    preferences.card_schedules = cleanSchedules;
  }

  if (body.warning_switches !== undefined) {
    if (!body.warning_switches || typeof body.warning_switches !== 'object' || Array.isArray(body.warning_switches)) {
      return { error: 'warning_switches must be an object' };
    }
    const cleanSwitches = {};
    for (const key of ['budget', 'pace', 'bills', 'goals']) {
      if (body.warning_switches[key] !== undefined) {
        if (typeof body.warning_switches[key] !== 'boolean') {
          return { error: `warning_switches.${key} must be a boolean` };
        }
        cleanSwitches[key] = body.warning_switches[key];
      }
    }
    preferences.warning_switches = cleanSwitches;
  }

  if (Object.keys(preferences).length === 0) {
    return { error: 'at least one of theme, currency, date_format or set-once settings is required' };
  }
  return { preferences };
}
