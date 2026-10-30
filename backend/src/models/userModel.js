import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { createDbPool } from '../db.js';

/**
 * User Database Model + password hashing
 * Joint Owners: Arpan Khatiwada & Suman Raut (Member 4 & 5)
 *
 * Password hashing uses Node's built-in crypto.scrypt (no native
 * dependencies, so it works on Windows). Hash format:
 *   scrypt$<salt_hex>$<derived_key_hex>
 * Plain-text passwords are never stored or returned.
 *
 * The MySQL pool is created lazily (once) so importing this file for
 * unit tests does not open a database connection.
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
// Source: backend/sql/seeds.sql template.
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

let pool = null;
function getPool() {
  if (!pool) pool = createDbPool();
  return pool;
}

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    display_name: row.display_name,
    email: row.email,
  };
}

export const UserModel = {
  async findByEmail(email) {
    const [rows] = await getPool().query(
      'SELECT id, display_name, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await getPool().query(
      'SELECT id, display_name, email, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ? toPublicUser(rows[0]) : null;
  },

  /**
   * Creates a user and seeds their default categories in one
   * transaction, so a new account never exists without categories
   * and a failed seed never leaves a half-created account.
   */
  async create({ displayName, email, passwordHash }) {
    // Original INSERT without google_sub, so password registration keeps
    // working on databases that have not run the Google migration yet.
    return createUserWithCategories({ displayName, email, passwordHash, googleSub: null, withGoogleColumn: false });
  },

  // --- Google Sign-In (requires migration 003_add_google_signin_to_users.sql) ---

  async findByGoogleSub(googleSub) {
    const [rows] = await getPool().query(
      'SELECT id, display_name, email, created_at FROM users WHERE google_sub = ? LIMIT 1',
      [googleSub]
    );
    return rows[0] ? toPublicUser(rows[0]) : null;
  },

  /** Creates a Google account: no password (password_hash stays NULL). */
  async createGoogleUser({ displayName, email, googleSub }) {
    return createUserWithCategories({ displayName, email, passwordHash: null, googleSub, withGoogleColumn: true });
  },

  /** Links a Google identity to an existing (password) account. */
  async linkGoogleSub(userId, googleSub) {
    await getPool().query('UPDATE users SET google_sub = ? WHERE id = ?', [googleSub, userId]);
  },
};

async function createUserWithCategories({ displayName, email, passwordHash, googleSub, withGoogleColumn }) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = withGoogleColumn
      ? await connection.query(
          'INSERT INTO users (display_name, email, password_hash, google_sub) VALUES (?, ?, ?, ?)',
          [displayName, email, passwordHash, googleSub]
        )
      : await connection.query(
          'INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)',
          [displayName, email, passwordHash]
        );
    const userId = result.insertId;
    for (const category of DEFAULT_CATEGORIES) {
      await connection.query(
        'INSERT IGNORE INTO categories (user_id, name, kind) VALUES (?, ?, ?)',
        [userId, category.name, category.kind]
      );
    }
    await connection.commit();
    return { id: Number(userId), display_name: displayName, email };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
