import { getDbPool } from '../db.js';
import { DEFAULT_CATEGORIES } from './userModel.js';

/**
 * Category Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Enforces per-user category isolation (Constitution A5, L1).
 */
const pool = getDbPool();

function toRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: row.name,
    kind: row.kind,
  };
}

export const CategoryModel = {
  async findByUser(userId) {
    const uid = Number(userId);
    const [rows] = await pool.execute(
      'SELECT id, user_id, name, kind FROM categories WHERE user_id = ? ORDER BY id ASC',
      [uid]
    );
    if (rows.length > 0) return rows.map(toRow);

    // If a user exists in users but has no categories yet, seed defaults.
    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [uid]);
    if (userRows.length === 0) return [];

    const placeholders = DEFAULT_CATEGORIES.map(() => '(?, ?, ?)').join(', ');
    const params = DEFAULT_CATEGORIES.flatMap((c) => [uid, c.name, c.kind]);
    await pool.execute(
      `INSERT IGNORE INTO categories (user_id, name, kind) VALUES ${placeholders}`,
      params
    );
    const [seeded] = await pool.execute(
      'SELECT id, user_id, name, kind FROM categories WHERE user_id = ? ORDER BY id ASC',
      [uid]
    );
    return seeded.map(toRow);
  },

  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      'SELECT id, user_id, name, kind FROM categories WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return toRow(rows[0]);
  },

  async findByNameAndUser(name, kind, userId) {
    const [rows] = await pool.execute(
      'SELECT id, user_id, name, kind FROM categories WHERE user_id = ? AND name = ? AND kind = ?',
      [Number(userId), name, kind]
    );
    return toRow(rows[0]);
  },

  async create({ userId, name, kind }) {
    const uid = Number(userId);
    const cleanName = String(name).trim().slice(0, 60);
    await pool.execute(
      'INSERT IGNORE INTO categories (user_id, name, kind) VALUES (?, ?, ?)',
      [uid, cleanName, kind]
    );
    return CategoryModel.findByNameAndUser(cleanName, kind, uid);
  },
};
