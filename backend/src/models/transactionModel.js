import { getDbPool } from '../db.js';

/**
 * Transaction Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Supports all Constitution Part C & F transaction kinds:
 * income, expense, transfer, card_payment, refund, reimbursement,
 * cashback, adjustment.
 */
const pool = getDbPool();

function toRow(row) {
  if (!row) return null;
  const noteVal = row.note || row.title || '';
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    account_id: row.account_id === null || row.account_id === undefined ? null : Number(row.account_id),
    to_account_id: row.to_account_id === null || row.to_account_id === undefined ? null : Number(row.to_account_id),
    category_id: row.category_id === null || row.category_id === undefined ? null : Number(row.category_id),
    category_name: row.category_name || null,
    kind: row.kind,
    title: row.title || noteVal,
    note: noteVal,
    amount: Number(row.amount),
    transaction_date: row.transaction_date,
    created_at: row.created_at,
  };
}

export const TransactionModel = {
  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT t.id, t.user_id, t.account_id, t.to_account_id, t.category_id,
              c.name AS category_name, t.kind, t.title, t.note, t.amount,
              DATE_FORMAT(t.transaction_date, '%Y-%m-%d') AS transaction_date, t.created_at
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id AND c.user_id = t.user_id
       WHERE t.user_id = ?
       ORDER BY t.transaction_date DESC, t.id DESC`,
      [Number(userId)]
    );
    return rows.map(toRow);
  },

  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      `SELECT t.id, t.user_id, t.account_id, t.to_account_id, t.category_id,
              c.name AS category_name, t.kind, t.title, t.note, t.amount,
              DATE_FORMAT(t.transaction_date, '%Y-%m-%d') AS transaction_date, t.created_at
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id AND c.user_id = t.user_id
       WHERE t.id = ? AND t.user_id = ?`,
      [Number(id), Number(userId)]
    );
    return toRow(rows[0]);
  },

  async create({
    userId,
    accountId = null,
    toAccountId = null,
    categoryId = null,
    kind,
    title,
    note = null,
    amount,
    transactionDate,
  }) {
    const cleanTitle = String(title || note || kind).trim().slice(0, 150);
    const cleanNote = String(note ?? title ?? '').trim().slice(0, 255) || cleanTitle;
    const [result] = await pool.execute(
      `INSERT INTO transactions
         (user_id, account_id, to_account_id, category_id, kind, title, note, amount, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(userId),
        accountId ? Number(accountId) : null,
        toAccountId ? Number(toAccountId) : null,
        categoryId ? Number(categoryId) : null,
        kind,
        cleanTitle,
        cleanNote,
        Number(amount),
        transactionDate,
      ]
    );
    const created = await TransactionModel.findByIdAndUser(result.insertId, userId);
    return created || { id: Number(result.insertId) };
  },

  async update(
    id,
    userId,
    { accountId, toAccountId, categoryId, kind, title, note, amount, transactionDate }
  ) {
    const existing = await TransactionModel.findByIdAndUser(id, userId);
    if (!existing) return null;
    const nextKind = kind !== undefined ? kind : existing.kind;
    const nextTitle = String(title ?? note ?? existing.title).trim().slice(0, 150);
    const nextNote = String(note ?? title ?? existing.note ?? '').trim().slice(0, 255) || nextTitle;
    const nextAmount = amount !== undefined ? Number(amount) : existing.amount;
    const nextDate = transactionDate !== undefined ? transactionDate : existing.transaction_date;
    const nextAccountId = accountId !== undefined ? (accountId ? Number(accountId) : null) : existing.account_id;
    const nextToAccountId = toAccountId !== undefined ? (toAccountId ? Number(toAccountId) : null) : existing.to_account_id;
    const nextCategoryId = categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : existing.category_id;

    await pool.execute(
      `UPDATE transactions
       SET account_id = ?, to_account_id = ?, category_id = ?, kind = ?, title = ?, note = ?, amount = ?, transaction_date = ?
       WHERE id = ? AND user_id = ?`,
      [
        nextAccountId,
        nextToAccountId,
        nextCategoryId,
        nextKind,
        nextTitle,
        nextNote,
        nextAmount,
        nextDate,
        Number(id),
        Number(userId),
      ]
    );
    return TransactionModel.findByIdAndUser(id, userId);
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM transactions WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  },
};
