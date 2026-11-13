import { getDbPool } from '../db.js';

/**
 * Budget Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Enforces Constitution Part E and A5 (per-user isolation).
 */
const pool = getDbPool();

function normalizeMonthDate(monthOrDate) {
  const str = String(monthOrDate || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(str)) return `${str}-01`;
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(str)) return `${str.slice(0, 7)}-01`;
  return null;
}

function toRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    category_id: Number(row.category_id),
    category_name: row.category_name || null,
    budget_month: String(row.budget_month).slice(0, 7),
    amount_limit: Number(row.amount_limit),
  };
}

export const BudgetModel = {
  normalizeMonthDate,

  async findByUser(userId, month = null) {
    const uid = Number(userId);
    if (month) {
      const monthDate = normalizeMonthDate(month);
      if (!monthDate) return [];
      const [rows] = await pool.execute(
        `SELECT b.id, b.user_id, b.category_id, c.name AS category_name,
                DATE_FORMAT(b.budget_month, '%Y-%m') AS budget_month, b.amount_limit
         FROM budgets b
         LEFT JOIN categories c ON b.category_id = c.id AND c.user_id = b.user_id
         WHERE b.user_id = ? AND b.budget_month = ?
         ORDER BY b.id ASC`,
        [uid, monthDate]
      );
      return rows.map(toRow);
    }

    const [rows] = await pool.execute(
      `SELECT b.id, b.user_id, b.category_id, c.name AS category_name,
              DATE_FORMAT(b.budget_month, '%Y-%m') AS budget_month, b.amount_limit
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id AND c.user_id = b.user_id
       WHERE b.user_id = ?
       ORDER BY b.budget_month DESC, b.id ASC`,
      [uid]
    );
    return rows.map(toRow);
  },

  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      `SELECT b.id, b.user_id, b.category_id, c.name AS category_name,
              DATE_FORMAT(b.budget_month, '%Y-%m') AS budget_month, b.amount_limit
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id AND c.user_id = b.user_id
       WHERE b.id = ? AND b.user_id = ?`,
      [Number(id), Number(userId)]
    );
    return toRow(rows[0]);
  },

  async upsert({ userId, categoryId, budgetMonth, amountLimit }) {
    const uid = Number(userId);
    const catId = Number(categoryId);
    const monthDate = normalizeMonthDate(budgetMonth);
    await pool.execute(
      `INSERT INTO budgets (user_id, category_id, budget_month, amount_limit)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE amount_limit = VALUES(amount_limit)`,
      [uid, catId, monthDate, Number(amountLimit)]
    );
    const [rows] = await pool.execute(
      `SELECT b.id, b.user_id, b.category_id, c.name AS category_name,
              DATE_FORMAT(b.budget_month, '%Y-%m') AS budget_month, b.amount_limit
       FROM budgets b
       LEFT JOIN categories c ON b.category_id = c.id AND c.user_id = b.user_id
       WHERE b.user_id = ? AND b.category_id = ? AND b.budget_month = ?`,
      [uid, catId, monthDate]
    );
    return toRow(rows[0]);
  },

  async updateById(id, userId, { amountLimit }) {
    const existing = await BudgetModel.findByIdAndUser(id, userId);
    if (!existing) return null;
    await pool.execute(
      'UPDATE budgets SET amount_limit = ? WHERE id = ? AND user_id = ?',
      [Number(amountLimit), Number(id), Number(userId)]
    );
    return BudgetModel.findByIdAndUser(id, userId);
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM budgets WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  },
};
