import { createDbPool } from '../db.js';

/**
 * User Database Model
 * Author: Rajesh
 */
export const UserModel = {
  async findByEmail(email) {
    const pool = createDbPool();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  },

  async create({ displayName, email, passwordHash }) {
    const pool = createDbPool();
    const [result] = await pool.query(
      'INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)',
      [displayName, email, passwordHash]
    );
    return { id: result.insertId, displayName, email };
  }
};
