/**
 * Savings Goal Model — IN-MEMORY STORE (no database)
 * Author: Rajesh
 *
 * DATABASE RESET — 2026-11-06, Arpan's decision: all backend database
 * integration was removed (MySQL pool, sql/, Turso). This model keeps
 * the same interface and snake_case row shape as the MySQL version,
 * backed by a process-memory Map until a new database is integrated.
 * Data is lost when the backend restarts.
 */
const goalsById = new Map();
let nextGoalId = 1;

export const GoalModel = {
  async findByUser(userId) {
    return [...goalsById.values()]
      .filter((row) => row.user_id === Number(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async create({ userId, title, targetAmount, savedAmount = 0, monthlyPlan = 0 }) {
    const row = {
      id: nextGoalId++,
      user_id: Number(userId),
      title,
      target_amount: targetAmount,
      saved_amount: savedAmount,
      monthly_plan: monthlyPlan,
      created_at: new Date(),
    };
    goalsById.set(row.id, row);
    return { id: row.id };
  },

  async contribute(id, userId, contribution) {
    const row = goalsById.get(Number(id));
    if (!row || row.user_id !== Number(userId)) return false;
    // Same cap semantics as the old SQL: LEAST(target_amount, saved + ?)
    row.saved_amount = Math.min(row.target_amount, row.saved_amount + contribution);
    return true;
  },

  async delete(id, userId) {
    const row = goalsById.get(Number(id));
    if (!row || row.user_id !== Number(userId)) return false;
    goalsById.delete(row.id);
    return true;
  }
};
