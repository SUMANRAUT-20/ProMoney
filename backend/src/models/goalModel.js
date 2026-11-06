import { getDbPool } from '../db.js';

/**
 * Savings Goal Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Author: Rajesh
 *
 * Step 2 (2026-11-06): same interface and snake_case row shape as the
 * in-memory baseline from the database reset, now backed by real SQL
 * storage (backend/sql/schema.sql). Data survives backend restarts.
 */
const pool = getDbPool();

function toRow(row) {
  return { ...row, id: Number(row.id), user_id: Number(row.user_id) };
}

export const GoalModel = {
  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, title, target_amount, saved_amount, monthly_plan, created_at
       FROM goals WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      [Number(userId)]
    );
    return rows.map(toRow);
  },

  async create({ userId, title, targetAmount, savedAmount = 0, monthlyPlan = 0 }) {
    const [result] = await pool.execute(
      `INSERT INTO goals (user_id, title, target_amount, saved_amount, monthly_plan)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(userId), title, targetAmount, savedAmount, monthlyPlan]
    );
    return { id: Number(result.insertId) };
  },

  async contribute(id, userId, contribution) {
    // Same cap semantics as the in-memory version: LEAST(target, saved + ?)
    const [result] = await pool.execute(
      `UPDATE goals SET saved_amount = LEAST(target_amount, saved_amount + ?)
       WHERE id = ? AND user_id = ?`,
      [contribution, Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM goals WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  }
};
