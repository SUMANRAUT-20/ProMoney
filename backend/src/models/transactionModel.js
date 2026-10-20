import { createDbPool } from '../db.js';

/**
 * Transaction Database Model
 * Author: Rajesh
 */
export const TransactionModel = {
  async findByUser(userId) {
    const pool = createDbPool();
    const [rows] = await pool.query(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC',
      [userId]
    );
    return rows;
  },

  async create({ userId, accountId, categoryId, kind, title, amount, transactionDate }) {
    const pool = createDbPool();
    const [result] = await pool.query(
      `INSERT INTO transactions (user_id, account_id, category_id, kind, title, amount, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, accountId || null, categoryId || null, kind, title, amount, transactionDate]
    );
    return { id: result.insertId };
  },

  async delete(id, userId) {
    const pool = createDbPool();
    const [result] = await pool.query(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
};
