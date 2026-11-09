import { getDbPool } from '../db.js';

/**
 * Transaction Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Author: Rajesh
 *
 * Step 2 (2026-11-06): same interface and snake_case row shape as the
 * in-memory baseline from the database reset, now backed by real SQL
 * storage (backend/sql/schema.sql). Data survives backend restarts.
 * transaction_date is returned as a 'YYYY-MM-DD' string, matching the
 * in-memory version's shape.
 */
const pool = getDbPool();

function toRow(row) {
  return {
    ...row,
    id: Number(row.id),
    user_id: Number(row.user_id),
    account_id: row.account_id === null ? null : Number(row.account_id),
    category_id: row.category_id === null ? null : Number(row.category_id),
  };
}

export const TransactionModel = {
  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, account_id, category_id, kind, title, amount,
              DATE_FORMAT(transaction_date, '%Y-%m-%d') AS transaction_date, created_at
       FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC, id DESC`,
      [Number(userId)]
    );
    return rows.map(toRow);
  },

  async create({ userId, accountId, categoryId, kind, title, amount, transactionDate }) {
    const [result] = await pool.execute(
      `INSERT INTO transactions (user_id, account_id, category_id, kind, title, amount, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(userId), accountId || null, categoryId || null, kind, title, amount, transactionDate]
    );
    return { id: Number(result.insertId) };
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  }
};
