import { createDbPool } from '../db.js';

/**
 * Savings Goal Database Model
 * Author: Rajesh
 */
export const GoalModel = {
  async findByUser(userId) {
    const pool = createDbPool();
    const [rows] = await pool.query(
      'SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  },

  async create({ userId, title, targetAmount, savedAmount = 0, monthlyPlan = 0 }) {
    const pool = createDbPool();
    const [result] = await pool.query(
      `INSERT INTO goals (user_id, title, target_amount, saved_amount, monthly_plan)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, targetAmount, savedAmount, monthlyPlan]
    );
    return { id: result.insertId };
  },

  async contribute(id, userId, contribution) {
    const pool = createDbPool();
    const [result] = await pool.query(
      `UPDATE goals 
       SET saved_amount = LEAST(target_amount, saved_amount + ?)
       WHERE id = ? AND user_id = ?`,
      [contribution, id, userId]
    );
    return result.affectedRows > 0;
  },

  async delete(id, userId) {
    const pool = createDbPool();
    const [result] = await pool.query(
      'DELETE FROM goals WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
};
