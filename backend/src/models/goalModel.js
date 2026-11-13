import { getDbPool } from '../db.js';

/**
 * Savings Goal Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Supports Constitution Part H (H1–H6) and A5 (per-user isolation).
 */
const pool = getDbPool();

function toRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    title: row.title,
    icon: row.icon || null,
    target_amount: Number(row.target_amount),
    saved_amount: Number(row.saved_amount),
    monthly_plan: Number(row.monthly_plan || 0),
    target_date: row.target_date || null,
    created_at: row.created_at,
  };
}

export const GoalModel = {
  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, title, icon, target_amount, saved_amount, monthly_plan,
              DATE_FORMAT(target_date, '%Y-%m-%d') AS target_date, created_at
       FROM goals WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      [Number(userId)]
    );
    return rows.map(toRow);
  },

  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, title, icon, target_amount, saved_amount, monthly_plan,
              DATE_FORMAT(target_date, '%Y-%m-%d') AS target_date, created_at
       FROM goals WHERE id = ? AND user_id = ?`,
      [Number(id), Number(userId)]
    );
    return toRow(rows[0]);
  },

  async create({
    userId,
    title,
    icon = null,
    targetAmount,
    savedAmount = 0,
    monthlyPlan = 0,
    targetDate = null,
  }) {
    const [result] = await pool.execute(
      `INSERT INTO goals (user_id, title, icon, target_amount, saved_amount, monthly_plan, target_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(userId),
        title,
        icon || null,
        Number(targetAmount),
        Number(savedAmount),
        Number(monthlyPlan),
        targetDate || null,
      ]
    );
    const created = await GoalModel.findByIdAndUser(result.insertId, userId);
    return created || { id: Number(result.insertId) };
  },

  async update(
    id,
    userId,
    { title, icon, targetAmount, savedAmount, monthlyPlan, targetDate }
  ) {
    const existing = await GoalModel.findByIdAndUser(id, userId);
    if (!existing) return null;
    const nextTitle = title !== undefined ? title : existing.title;
    const nextIcon = icon !== undefined ? icon : existing.icon;
    const nextTarget = targetAmount !== undefined ? Number(targetAmount) : existing.target_amount;
    const nextSaved = savedAmount !== undefined ? Number(savedAmount) : existing.saved_amount;
    const nextPlan = monthlyPlan !== undefined ? Number(monthlyPlan) : existing.monthly_plan;
    const nextDate = targetDate !== undefined ? targetDate : existing.target_date;

    await pool.execute(
      `UPDATE goals
       SET title = ?, icon = ?, target_amount = ?, saved_amount = ?, monthly_plan = ?, target_date = ?
       WHERE id = ? AND user_id = ?`,
      [nextTitle, nextIcon, nextTarget, nextSaved, nextPlan, nextDate, Number(id), Number(userId)]
    );
    return GoalModel.findByIdAndUser(id, userId);
  },

  async contribute(id, userId, contribution) {
    const existing = await GoalModel.findByIdAndUser(id, userId);
    if (!existing) return null;
    const nextSaved =
      existing.target_amount > 0
        ? Math.min(existing.target_amount, existing.saved_amount + Number(contribution))
        : existing.saved_amount + Number(contribution);
    await pool.execute(
      'UPDATE goals SET saved_amount = ? WHERE id = ? AND user_id = ?',
      [nextSaved, Number(id), Number(userId)]
    );
    return GoalModel.findByIdAndUser(id, userId);
  },

  async withdraw(id, userId, amount) {
    const existing = await GoalModel.findByIdAndUser(id, userId);
    if (!existing) return null;
    const nextSaved = Math.max(0, existing.saved_amount - Number(amount));
    await pool.execute(
      'UPDATE goals SET saved_amount = ? WHERE id = ? AND user_id = ?',
      [nextSaved, Number(id), Number(userId)]
    );
    return GoalModel.findByIdAndUser(id, userId);
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM goals WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  },
};
