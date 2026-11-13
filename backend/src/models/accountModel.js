import { getDbPool } from '../db.js';

/**
 * Account Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Enforces Constitution B1–B6, A5 (user isolation), and L3 (an account
 * with records is never deleted into orphans).
 */
const pool = getDbPool();

function parseUiDetails(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: row.name,
    kind: row.kind,
    manual_balance: Number(row.manual_balance),
    currency: row.currency || 'JPY',
    ui_details: parseUiDetails(row.ui_details),
    created_at: row.created_at,
  };
}

export const AccountModel = {
  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, name, kind, manual_balance, currency, ui_details, created_at
       FROM accounts WHERE user_id = ? ORDER BY id ASC`,
      [Number(userId)]
    );
    return rows.map(toRow);
  },

  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, name, kind, manual_balance, currency, ui_details, created_at
       FROM accounts WHERE id = ? AND user_id = ?`,
      [Number(id), Number(userId)]
    );
    return toRow(rows[0]);
  },

  async create({ userId, name, kind = 'cash', manualBalance = 0, currency = 'JPY', uiDetails = null }) {
    const uiJson = uiDetails ? JSON.stringify(uiDetails) : null;
    const [result] = await pool.execute(
      `INSERT INTO accounts (user_id, name, kind, manual_balance, currency, ui_details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(userId), name, kind, Number(manualBalance), currency, uiJson]
    );
    return AccountModel.findByIdAndUser(result.insertId, userId);
  },

  async update(id, userId, { name, kind, manualBalance, uiDetails }) {
    const existing = await AccountModel.findByIdAndUser(id, userId);
    if (!existing) return null;
    const nextName = name !== undefined ? name : existing.name;
    const nextKind = kind !== undefined ? kind : existing.kind;
    const nextBal = manualBalance !== undefined ? Number(manualBalance) : existing.manual_balance;
    const nextUi = uiDetails !== undefined ? uiDetails : existing.ui_details;
    const uiJson = nextUi ? JSON.stringify(nextUi) : null;

    await pool.execute(
      `UPDATE accounts SET name = ?, kind = ?, manual_balance = ?, ui_details = ?
       WHERE id = ? AND user_id = ?`,
      [nextName, nextKind, nextBal, uiJson, Number(id), Number(userId)]
    );
    return AccountModel.findByIdAndUser(id, userId);
  },

  async countLinkedTransactions(id, userId) {
    const accId = Number(id);
    const uid = Number(userId);
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS n FROM transactions
       WHERE user_id = ? AND (account_id = ? OR to_account_id = ?)`,
      [uid, accId, accId]
    );
    return Number(rows[0]?.n ?? rows[0]?.N ?? 0);
  },

  /**
   * Constitution L3: An account with records is never deleted into orphans.
   * Throws an error with code 'ACCOUNT_HAS_RECORDS' if linked transactions exist.
   */
  async delete(id, userId) {
    const existing = await AccountModel.findByIdAndUser(id, userId);
    if (!existing) return false;
    const linked = await AccountModel.countLinkedTransactions(id, userId);
    if (linked > 0) {
      const err = new Error('Cannot delete an account that has linked transactions (Constitution L3)');
      err.code = 'ACCOUNT_HAS_RECORDS';
      err.status = 409;
      throw err;
    }
    const [result] = await pool.execute(
      'DELETE FROM accounts WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  },
};
