import { getDbPool } from '../db.js';
import { DEFAULT_CATEGORIES, DEMO_CATEGORIES } from './defaultCategories.js';
import { isDemoUser } from './userModel.js';

const pool = getDbPool();
const defaultsFor = (owner) => isDemoUser(owner) ? DEMO_CATEGORIES : DEFAULT_CATEGORIES;
const sameName = (left, right) => left.toLowerCase() === right.toLowerCase();

function toRow(row, defaults) {
  const preset = defaults.find((category) => category.kind === row.kind && sameName(category.name, row.name));
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: preset?.name ?? row.name,
    kind: row.kind,
    is_default: Boolean(preset),
  };
}

function categoryError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function withCategoryLock(userId, change) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Serialize names across kinds, including for users with legacy duplicate names.
    const [[owner]] = await connection.execute('SELECT email FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!owner) throw categoryError(404, 'User not found');
    const result = await change(connection, defaultsFor(owner));
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function matchingNames(connection, userId, name) {
  const [rows] = await connection.execute(
    'SELECT id, user_id, name, kind FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?) FOR UPDATE',
    [userId, name]
  );
  return rows;
}

async function findCustom(connection, id, userId, defaults) {
  if (!Number.isSafeInteger(id) || id <= 0) throw categoryError(404, 'Category not found');
  const [[row]] = await connection.execute(
    'SELECT id, user_id, name, kind FROM categories WHERE id = ? AND user_id = ? FOR UPDATE',
    [id, userId]
  );
  if (!row) throw categoryError(404, 'Category not found');
  const category = toRow(row, defaults);
  if (category.is_default) throw categoryError(403, 'Default categories cannot be changed');
  return category;
}

async function listRows(userId) {
  const [rows] = await pool.execute(
    `SELECT c.id, c.user_id, c.name, c.kind, u.email
     FROM categories c JOIN users u ON c.user_id = u.id
     WHERE c.user_id = ? ORDER BY c.id ASC`,
    [userId]
  );
  return rows;
}

export const CategoryModel = {
  async findByUser(userId, { seedDefaults = true } = {}) {
    const uid = Number(userId);
    let rows = await listRows(uid);
    if (!seedDefaults) return rows.map((row) => toRow(row, defaultsFor(row)));

    const owner = rows[0] ?? (await pool.execute('SELECT email FROM users WHERE id = ?', [uid]))[0][0];
    if (!owner) return [];
    const defaults = defaultsFor(owner);
    const missing = defaults.filter((preset) => !rows.some((row) => row.kind === preset.kind && sameName(row.name, preset.name)));
    if (missing.length) {
      const placeholders = missing.map(() => '(?, ?, ?)').join(', ');
      await pool.execute(
        `INSERT IGNORE INTO categories (user_id, name, kind) VALUES ${placeholders}`,
        missing.flatMap(({ name, kind }) => [uid, name, kind])
      );
      rows = await listRows(uid);
    }
    return rows.map((row) => toRow(row, defaults));
  },

  async findByIdAndUser(id, userId) {
    const [[row]] = await pool.execute(
      `SELECT c.id, c.user_id, c.name, c.kind, u.email
       FROM categories c JOIN users u ON c.user_id = u.id
       WHERE c.id = ? AND c.user_id = ?`,
      [Number(id), Number(userId)]
    );
    return row ? toRow(row, defaultsFor(row)) : null;
  },

  async create({ userId, name, kind, reuseExisting = false }) {
    const uid = Number(userId);
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 60) throw categoryError(400, 'Category name must be 1–60 characters');
    return withCategoryLock(uid, async (connection, defaults) => {
      const matches = await matchingNames(connection, uid, cleanName);
      const existing = matches.find((row) => row.kind === kind);
      if (reuseExisting && existing) return toRow(existing, defaults);
      const preset = defaults.find((category) => sameName(category.name, cleanName));
      if (matches.length || (preset && (!reuseExisting || kind !== preset.kind))) {
        throw categoryError(409, 'A category with that name already exists');
      }
      const savedName = preset?.name ?? cleanName;
      const [result] = await connection.execute(
        'INSERT INTO categories (user_id, name, kind) VALUES (?, ?, ?)',
        [uid, savedName, kind]
      );
      return toRow({ id: result.insertId, user_id: uid, name: savedName, kind }, defaults);
    });
  },

  async rename(id, userId, name) {
    const uid = Number(userId);
    return withCategoryLock(uid, async (connection, defaults) => {
      const category = await findCustom(connection, Number(id), uid, defaults);
      const matches = await matchingNames(connection, uid, name);
      if (matches.some((row) => Number(row.id) !== category.id) || defaults.some((preset) => sameName(preset.name, name))) {
        throw categoryError(409, 'A category with that name already exists');
      }
      await connection.execute('UPDATE categories SET name = ? WHERE id = ? AND user_id = ?', [name, category.id, uid]);
      return { ...category, name };
    });
  },

  async delete(id, userId) {
    const uid = Number(userId);
    await withCategoryLock(uid, async (connection, defaults) => {
      const category = await findCustom(connection, Number(id), uid, defaults);
      await connection.execute('DELETE FROM categories WHERE id = ? AND user_id = ?', [category.id, uid]);
    });
  },
};
