import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * User Model + password hashing — IN-MEMORY STORE (no database)
 * Joint Owners: Arpan Khatiwada & Suman Raut (Member 4 & 5)
 *
 * DATABASE RESET — 2026-11-06, Arpan's decision: ALL backend database
 * integration was removed (the MySQL pool in src/db.js, the pluggable
 * AUTH_STORE switch, and the Turso/libSQL mode) so database work can
 * restart from a clean first step later. Until a new database is
 * integrated, users and their seeded categories live in process
 * memory (Maps below).
 *
 * Honest limitations of this baseline:
 * - Accounts are LOST when the backend process restarts.
 * - Google sign-in accounts work the same way (google_sub kept on the
 *   in-memory row); GOOGLE_CLIENT_ID is still required for the flow.
 *
 * Password hashing uses Node's built-in crypto.scrypt (no native
 * dependencies, so it works on Windows). Hash format:
 *   scrypt$<salt_hex>$<derived_key_hex>
 * Plain-text passwords are never stored or returned.
 *
 * The exported interface (UserModel methods, hashPassword,
 * verifyPassword, toPublicUser, getCategoryCount, DEFAULT_CATEGORIES)
 * is unchanged from the database version, so authController and the
 * tests did not need changes.
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
// (Was backend/sql/seeds.sql template; the sql folder was removed in
// the 2026-11-06 database reset, so this list is the source now.)
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

console.log('[auth] in-memory user store (no database; data resets on restart)');

const usersById = new Map();
const usersByEmail = new Map();
const usersByGoogleSub = new Map();
const categoriesByUserId = new Map();
let nextUserId = 1;

function createUser({ displayName, email, passwordHash, googleSub }) {
  if (usersByEmail.has(email)) {
    // Same error code the MySQL store produced, so authController
    // keeps mapping duplicates to HTTP 409 unchanged.
    const err = new Error(`Duplicate entry '${email}' for key 'users.email'`);
    err.code = 'ER_DUP_ENTRY';
    throw err;
  }
  const row = {
    id: nextUserId++,
    display_name: displayName,
    email,
    password_hash: passwordHash,
    google_sub: googleSub,
    created_at: new Date(),
  };
  usersById.set(row.id, row);
  usersByEmail.set(email, row);
  if (googleSub) usersByGoogleSub.set(googleSub, row);
  categoriesByUserId.set(
    row.id,
    DEFAULT_CATEGORIES.map((category) => ({ user_id: row.id, ...category }))
  );
  return toPublicUser(row);
}

/** Number of seeded categories a user has (used by tests/diagnostics). */
export async function getCategoryCount(userId) {
  return (categoriesByUserId.get(Number(userId)) || []).length;
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
    return usersByEmail.get(email) || null;
  },

  async findById(id) {
    return toPublicUser(usersById.get(Number(id)) || null);
  },

  /** Creates a user and seeds their default categories. */
  async create({ displayName, email, passwordHash }) {
    return createUser({ displayName, email, passwordHash, googleSub: null });
  },

  // --- Google Sign-In ---

  async findByGoogleSub(googleSub) {
    return toPublicUser(usersByGoogleSub.get(googleSub) || null);
  },

  /** Creates a Google account: no password (password_hash stays null). */
  async createGoogleUser({ displayName, email, googleSub }) {
    return createUser({ displayName, email, passwordHash: null, googleSub });
  },

  /** Links a Google identity to an existing (password) account. */
  async linkGoogleSub(userId, googleSub) {
    const row = usersById.get(Number(userId));
    if (row) {
      row.google_sub = googleSub;
      usersByGoogleSub.set(googleSub, row);
    }
  },
};
