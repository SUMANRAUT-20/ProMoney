import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@libsql/client';
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

/**
 * Optional no-database mode — AUTH_STORE=memory (backend/.env)
 *
 * Added 2026-10-30 at Arpan's request so ProMoney auth can run in the
 * browser on a machine with NO MySQL server: users and their seeded
 * categories live in process memory instead of MySQL tables.
 * - Same UserModel interface and return shapes as the MySQL mode.
 * - MySQL stays the DEFAULT (team/contract setup); memory mode is
 *   strictly opt-in via the environment variable.
 * - Honest limitation: accounts are lost when the backend restarts,
 *   and Google sign-in still needs GOOGLE_CLIENT_ID configured.
 */
const USE_MEMORY_STORE = process.env.AUTH_STORE === 'memory';
if (USE_MEMORY_STORE) {
  console.log('[auth] AUTH_STORE=memory: using in-memory user store (no MySQL; data resets on restart)');
}
const memoryUsersById = new Map();
const memoryUsersByEmail = new Map();
const memoryUsersByGoogleSub = new Map();
const memoryCategoriesByUserId = new Map();
let memoryNextUserId = 1;

function memoryCreateUser({ displayName, email, passwordHash, googleSub }) {
  if (memoryUsersByEmail.has(email)) {
    const err = new Error(`Duplicate entry '${email}' for key 'users.email'`);
    err.code = 'ER_DUP_ENTRY';
    throw err;
  }
  const row = {
    id: memoryNextUserId++,
    display_name: displayName,
    email,
    password_hash: passwordHash,
    google_sub: googleSub,
    created_at: new Date(),
  };
  memoryUsersById.set(row.id, row);
  memoryUsersByEmail.set(email, row);
  if (googleSub) memoryUsersByGoogleSub.set(googleSub, row);
  memoryCategoriesByUserId.set(
    row.id,
    DEFAULT_CATEGORIES.map((category) => ({ user_id: row.id, ...category }))
  );
  return toPublicUser(row);
}

/** Number of seeded categories a user has (used by tests/diagnostics). */
export async function getCategoryCount(userId) {
  if (USE_MEMORY_STORE) {
    return (memoryCategoriesByUserId.get(Number(userId)) || []).length;
  }
  if (USE_TURSO_STORE) {
    const client = await getTursoClient();
    const result = await client.execute({
      sql: 'SELECT COUNT(*) AS count FROM categories WHERE user_id = ?',
      args: [Number(userId)],
    });
    return Number(result.rows[0].count);
  }
  const [rows] = await getPool().query('SELECT COUNT(*) AS count FROM categories WHERE user_id = ?', [userId]);
  return Number(rows[0].count);
}

/**
 * Turso (libSQL) mode — AUTH_STORE=turso (backend/.env)
 *
 * Added 2026-10-30 at Arpan's request: ProMoney auth currently runs
 * against his Turso database (org: kayabaakihikoo) until the team moves
 * to the final database. Same UserModel interface as MySQL/memory, so
 * switching stores is an .env change, not a rewrite.
 * Requires TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN.
 * The two auth tables are created IF NOT EXISTS on first use, with the
 * same shape as the MySQL schema + migration 003 (google_sub unique,
 * password_hash nullable for Google-only accounts).
 */
const USE_TURSO_STORE = process.env.AUTH_STORE === 'turso';
if (USE_TURSO_STORE) {
  console.log('[auth] AUTH_STORE=turso: using Turso (libSQL) user store');
}
let tursoClient = null;
let tursoSchemaReady = null;

async function getTursoClient() {
  if (!tursoClient) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      const err = new Error('TURSO_DATABASE_URL is not configured (required when AUTH_STORE=turso)');
      err.status = 500;
      throw err;
    }
    tursoClient = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
  }
  if (!tursoSchemaReady) {
    tursoSchemaReady = (async () => {
      await tursoClient.batch(
        [
          `CREATE TABLE IF NOT EXISTS users (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             display_name TEXT NOT NULL,
             email TEXT NOT NULL UNIQUE,
             password_hash TEXT,
             google_sub TEXT UNIQUE,
             created_at TEXT NOT NULL DEFAULT (datetime('now'))
           )`,
          `CREATE TABLE IF NOT EXISTS categories (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             user_id INTEGER NOT NULL,
             name TEXT NOT NULL,
             kind TEXT NOT NULL,
             UNIQUE (user_id, name)
           )`,
        ],
        'write'
      );
    })();
  }
  await tursoSchemaReady;
  return tursoClient;
}

function tursoRowToUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    display_name: row.display_name,
    email: row.email,
    password_hash: row.password_hash ?? null,
    google_sub: row.google_sub ?? null,
    created_at: row.created_at,
  };
}

function asDuplicateEmailError(err, email) {
  if (err && /unique constraint failed/i.test(String(err.message || ''))) {
    const dup = new Error(`Duplicate entry '${email}' for key 'users.email'`);
    dup.code = 'ER_DUP_ENTRY';
    return dup;
  }
  return err;
}

async function tursoCreateUser({ displayName, email, passwordHash, googleSub }) {
  const client = await getTursoClient();
  let userId;
  try {
    const result = await client.execute({
      sql: 'INSERT INTO users (display_name, email, password_hash, google_sub) VALUES (?, ?, ?, ?)',
      args: [displayName, email, passwordHash, googleSub],
    });
    userId = Number(result.lastInsertRowid);
  } catch (err) {
    throw asDuplicateEmailError(err, email);
  }
  await client.batch(
    DEFAULT_CATEGORIES.map((category) => ({
      sql: 'INSERT OR IGNORE INTO categories (user_id, name, kind) VALUES (?, ?, ?)',
      args: [userId, category.name, category.kind],
    })),
    'write'
  );
  return { id: userId, display_name: displayName, email };
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
    if (USE_MEMORY_STORE) return memoryUsersByEmail.get(email) || null;
    if (USE_TURSO_STORE) {
      const client = await getTursoClient();
      const result = await client.execute({
        sql: 'SELECT id, display_name, email, password_hash, google_sub, created_at FROM users WHERE email = ? LIMIT 1',
        args: [email],
      });
      return tursoRowToUser(result.rows[0]);
    }
    const [rows] = await getPool().query(
      'SELECT id, display_name, email, password_hash, created_at FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    if (USE_MEMORY_STORE) return toPublicUser(memoryUsersById.get(Number(id)) || null);
    if (USE_TURSO_STORE) {
      const client = await getTursoClient();
      const result = await client.execute({
        sql: 'SELECT id, display_name, email, created_at FROM users WHERE id = ? LIMIT 1',
        args: [Number(id)],
      });
      return toPublicUser(result.rows[0] ? tursoRowToUser(result.rows[0]) : null);
    }
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
    if (USE_MEMORY_STORE) return memoryCreateUser({ displayName, email, passwordHash, googleSub: null });
    if (USE_TURSO_STORE) return tursoCreateUser({ displayName, email, passwordHash, googleSub: null });
    // Original INSERT without google_sub, so password registration keeps
    // working on databases that have not run the Google migration yet.
    return createUserWithCategories({ displayName, email, passwordHash, googleSub: null, withGoogleColumn: false });
  },

  // --- Google Sign-In (requires migration 003_add_google_signin_to_users.sql) ---

  async findByGoogleSub(googleSub) {
    if (USE_MEMORY_STORE) return toPublicUser(memoryUsersByGoogleSub.get(googleSub) || null);
    if (USE_TURSO_STORE) {
      const client = await getTursoClient();
      const result = await client.execute({
        sql: 'SELECT id, display_name, email, created_at FROM users WHERE google_sub = ? LIMIT 1',
        args: [googleSub],
      });
      return toPublicUser(result.rows[0] ? tursoRowToUser(result.rows[0]) : null);
    }
    const [rows] = await getPool().query(
      'SELECT id, display_name, email, created_at FROM users WHERE google_sub = ? LIMIT 1',
      [googleSub]
    );
    return rows[0] ? toPublicUser(rows[0]) : null;
  },

  /** Creates a Google account: no password (password_hash stays NULL). */
  async createGoogleUser({ displayName, email, googleSub }) {
    if (USE_MEMORY_STORE) return memoryCreateUser({ displayName, email, passwordHash: null, googleSub });
    if (USE_TURSO_STORE) return tursoCreateUser({ displayName, email, passwordHash: null, googleSub });
    return createUserWithCategories({ displayName, email, passwordHash: null, googleSub, withGoogleColumn: true });
  },

  /** Links a Google identity to an existing (password) account. */
  async linkGoogleSub(userId, googleSub) {
    if (USE_MEMORY_STORE) {
      const row = memoryUsersById.get(Number(userId));
      if (row) {
        row.google_sub = googleSub;
        memoryUsersByGoogleSub.set(googleSub, row);
      }
      return;
    }
    if (USE_TURSO_STORE) {
      const client = await getTursoClient();
      await client.execute({
        sql: 'UPDATE users SET google_sub = ? WHERE id = ?',
        args: [googleSub, Number(userId)],
      });
      return;
    }
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
