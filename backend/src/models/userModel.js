import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getDbPool } from '../db.js';

/**
 * User Model + password hashing — DATABASE STORE (MySQL / TiDB Cloud)
 * Joint Owners: Arpan Khatiwada & Suman Raut (Member 4 & 5)
 *
 * Step 2 (2026-11-06, Suman + Munna): the in-memory baseline from the
 * database reset is replaced with real SQL storage. The exported
 * interface (UserModel methods, hashPassword, verifyPassword,
 * toPublicUser, getCategoryCount, DEFAULT_CATEGORIES) is IDENTICAL to
 * the in-memory version, so authController and the tests did not need
 * changes. Schema: backend/sql/schema.sql + migration 003 (google_sub).
 * Accounts now survive backend restarts.
 *
 * Password hashing uses Node's built-in crypto.scrypt (no native
 * dependencies, so it works on Windows). Hash format:
 *   scrypt$<salt_hex>$<derived_key_hex>
 * Plain-text passwords are never stored or returned.
 */

const SCRYPT_KEY_LENGTH = 64;

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

// Default JPY categories seeded for every new user.
export const DEFAULT_CATEGORIES = [
  { name: 'Salary', kind: 'income' },
  { name: 'Freelance', kind: 'income' },
  { name: 'Housing', kind: 'expense' },
  { name: 'Food & Dining', kind: 'expense' },
  { name: 'Transportation', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Shopping', kind: 'expense' },
  { name: 'Entertainment', kind: 'expense' },
];

const pool = getDbPool();

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    display_name: row.display_name,
    email: row.email,
  };
}

function toFullRow(row) {
  if (!row) return null;
  return { ...row, id: Number(row.id) };
}

async function createUser({ displayName, email, passwordHash, googleSub }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // A duplicate email throws the native MySQL ER_DUP_ENTRY error,
    // which authController maps to HTTP 409 (same as both prior stores).
    const [result] = await connection.execute(
      'INSERT INTO users (display_name, email, password_hash, google_sub) VALUES (?, ?, ?, ?)',
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
      'SELECT id, display_name, email FROM users WHERE id = ?',
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
      'SELECT id, display_name, email FROM users WHERE google_sub = ?',
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

  // --- Settings (profile & security) ---

  /**
   * Full row INCLUDING password_hash / google_sub. Server-side use
   * only (settings password change) — never send this to a client;
   * use toPublicUser for responses.
   */
  async findByIdWithCredentials(id) {
    return usersById.get(Number(id)) || null;
  },

  /** Updates the display name; returns the public user or null. */
  async updateDisplayName(userId, displayName) {
    const row = usersById.get(Number(userId));
    if (!row) return null;
    row.display_name = displayName;
    return toPublicUser(row);
  },

  /** Replaces the password hash (password change in Settings). */
  async updatePasswordHash(userId, passwordHash) {
    const row = usersById.get(Number(userId));
    if (!row) return false;
    row.password_hash = passwordHash;
    return true;
  },
};
