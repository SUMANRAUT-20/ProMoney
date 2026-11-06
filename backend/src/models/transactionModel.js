/**
 * Transaction Model — IN-MEMORY STORE (no database)
 * Author: Rajesh
 *
 * DATABASE RESET — 2026-11-06, Arpan's decision: all backend database
 * integration was removed (MySQL pool, sql/, Turso). This model keeps
 * the same interface and snake_case row shape as the MySQL version,
 * backed by a process-memory Map until a new database is integrated.
 * Data is lost when the backend restarts.
 */
const transactionsById = new Map();
let nextTransactionId = 1;

export const TransactionModel = {
  async findByUser(userId) {
    return [...transactionsById.values()]
      .filter((row) => row.user_id === Number(userId))
      .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
  },

  async create({ userId, accountId, categoryId, kind, title, amount, transactionDate }) {
    const row = {
      id: nextTransactionId++,
      user_id: Number(userId),
      account_id: accountId || null,
      category_id: categoryId || null,
      kind,
      title,
      amount,
      transaction_date: transactionDate,
      created_at: new Date(),
    };
    transactionsById.set(row.id, row);
    return { id: row.id };
  },

  async delete(id, userId) {
    const row = transactionsById.get(Number(id));
    if (!row || row.user_id !== Number(userId)) return false;
    transactionsById.delete(row.id);
    return true;
  }
};
