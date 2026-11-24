import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDbPool } from '../db.js';
import { DEFAULT_CATEGORIES } from './defaultCategories.js';

export { DEFAULT_CATEGORIES } from './defaultCategories.js';

/**
 * User Model + password hashing — DATABASE STORE (MySQL / TiDB Cloud)
 * Joint Owners: Arpan Khatiwada & Suman Raut (Member 4 & 5)
 *
 * Password hashing stays Node's built-in crypto.scrypt (Phase 3 Rule 7).
 * Includes token_version management for session revocation (Phase 3 Rule 2)
 * and password policy validation (Phase 3 Rule 4).
 */

const SCRYPT_KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password, storedHash) {
  try {
    if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
    const [scheme, saltHex, keyHex] = storedHash.split('$');
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length !== SCRYPT_KEY_LENGTH) return false;
    const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Phase 3 Rule 4 — Password policy:
 * Minimum 10 characters, at least one letter and one digit.
 */
export function validatePasswordPolicy(password, fieldName = 'password') {
  if (typeof password !== 'string' || !password) {
    return `${fieldName} is required`;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `${fieldName} must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `${fieldName} must be ${MAX_PASSWORD_LENGTH} characters or fewer`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return `${fieldName} must contain at least one letter and one digit`;
  }
  return null;
}

const pool = getDbPool();

// Synchronized token_version cache so requireAuth can check revocations
// synchronously while staying backed by SQL users.token_version.
const tokenVersionCache = new Map();

export function getCachedTokenVersion(userId) {
  return tokenVersionCache.get(Number(userId));
}

export function setCachedTokenVersion(userId, version) {
  tokenVersionCache.set(Number(userId), Number(version ?? 0));
}

export function getDemoEmail() {
  return String(process.env.DEMO_EMAIL || 'demo@promoney.local').trim().toLowerCase();
}

export function isDemoUser(userOrRow) {
  if (!userOrRow) return false;
  const email = typeof userOrRow === 'string' ? userOrRow : userOrRow.email;
  return String(email || '').trim().toLowerCase() === getDemoEmail();
}

export function toPublicUser(row) {
  if (!row) return null;
  if (row.token_version !== undefined) {
    setCachedTokenVersion(row.id, row.token_version);
  }
  return {
    id: Number(row.id),
    display_name: row.display_name,
    email: row.email,
    ...(isDemoUser(row) ? { is_demo: true } : {}),
  };
}

function toFullRow(row) {
  if (!row) return null;
  const tv = Number(row.token_version ?? 0);
  setCachedTokenVersion(row.id, tv);
  return { ...row, id: Number(row.id), token_version: tv };
}

async function createUser({ displayName, email, passwordHash, googleSub }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      'INSERT INTO users (display_name, email, password_hash, google_sub, token_version) VALUES (?, ?, ?, ?, 0)',
      [displayName, email, passwordHash, googleSub]
    );
    const userId = Number(result.insertId);
    const placeholders = DEFAULT_CATEGORIES.map(() => '(?, ?, ?)').join(', ');
    const params = DEFAULT_CATEGORIES.flatMap((c) => [userId, c.name, c.kind]);
    await connection.execute(
      `INSERT INTO categories (user_id, name, kind) VALUES ${placeholders}`,
      params
    );
    await connection.commit();
    setCachedTokenVersion(userId, 0);
    return { id: userId, display_name: displayName, email };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/** Number of seeded categories a user has (used by tests/diagnostics). */
export async function getCategoryCount(userId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS n FROM categories WHERE user_id = ?',
    [Number(userId)]
  );
  return Number(rows[0].n);
}

export const UserModel = {
  async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    return toFullRow(rows[0]);
  },

  async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, display_name, email, token_version FROM users WHERE id = ?',
      [Number(id)]
    );
    return toPublicUser(rows[0] || null);
  },

  /** Creates a user and seeds their default categories. */
  async create({ displayName, email, passwordHash }) {
    return createUser({ displayName, email, passwordHash, googleSub: null });
  },

  // --- Google Sign-In ---

  async findByGoogleSub(googleSub) {
    const [rows] = await pool.execute(
      'SELECT id, display_name, email, token_version FROM users WHERE google_sub = ?',
      [googleSub]
    );
    return toPublicUser(rows[0] || null);
  },

  /** Creates a Google account: no password (password_hash stays null). */
  async createGoogleUser({ displayName, email, googleSub }) {
    return createUser({ displayName, email, passwordHash: null, googleSub });
  },

  /** Links a Google identity to an existing (password) account. */
  async linkGoogleSub(userId, googleSub) {
    await pool.execute('UPDATE users SET google_sub = ? WHERE id = ?', [
      googleSub,
      Number(userId),
    ]);
  },

  // --- Settings & Session Revocation (Phase 3) ---

  async findByIdWithCredentials(id) {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [Number(id)]);
    return toFullRow(rows[0]);
  },

  async updateDisplayName(userId, displayName) {
    const [result] = await pool.execute(
      'UPDATE users SET display_name = ? WHERE id = ?',
      [displayName, Number(userId)]
    );
    if (result.affectedRows === 0) return null;
    return UserModel.findById(userId);
  },

  /**
   * Replaces the password hash AND increments token_version so all
   * existing sessions/devices are signed out immediately (Phase 3 Rule 2).
   */
  async updatePasswordHash(userId, passwordHash) {
    const uid = Number(userId);
    const [result] = await pool.execute(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [passwordHash, uid]
    );
    if (result.affectedRows === 0) return false;
    await UserModel.getTokenVersion(uid);
    return true;
  },

  async getTokenVersion(userId) {
    const uid = Number(userId);
    const [rows] = await pool.execute(
      'SELECT token_version FROM users WHERE id = ?',
      [uid]
    );
    if (!rows[0]) return null;
    const tv = Number(rows[0].token_version ?? 0);
    setCachedTokenVersion(uid, tv);
    return tv;
  },

  async incrementTokenVersion(userId) {
    const uid = Number(userId);
    const [result] = await pool.execute(
      'UPDATE users SET token_version = token_version + 1 WHERE id = ?',
      [uid]
    );
    if (result.affectedRows === 0) return null;
    return UserModel.getTokenVersion(uid);
  },
};
