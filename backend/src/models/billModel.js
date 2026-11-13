import { getDbPool } from '../db.js';

/**
 * Bill Model — DATABASE STORE (MySQL / TiDB Cloud)
 * Supports Constitution Part G (G1–G5) and A5 (per-user isolation).
 */
const pool = getDbPool();

function toRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: row.name,
    amount: Number(row.amount),
    due_date: row.due_date,
    category: row.category || 'Utilities',
    frequency: row.frequency || 'monthly',
    is_paid: Boolean(row.is_paid),
    notes: row.notes || '',
    created_at: row.created_at,
  };
}

export const BillModel = {
  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, name, amount, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              category, frequency, is_paid, notes, created_at
       FROM bills WHERE user_id = ? ORDER BY due_date ASC, id ASC`,
      [Number(userId)]
    );
    return rows.map(toRow);
  },

  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, name, amount, DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              category, frequency, is_paid, notes, created_at
       FROM bills WHERE id = ? AND user_id = ?`,
      [Number(id), Number(userId)]
    );
    return toRow(rows[0]);
  },

  async create({
    userId,
    name,
    amount,
    dueDate,
    category = 'Utilities',
    frequency = 'monthly',
    isPaid = false,
    notes = '',
  }) {
    const [result] = await pool.execute(
      `INSERT INTO bills (user_id, name, amount, due_date, category, frequency, is_paid, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(userId),
        String(name).trim().slice(0, 100),
        Number(amount),
        dueDate,
        String(category || 'Utilities').trim().slice(0, 60),
        frequency,
        isPaid ? 1 : 0,
        String(notes || '').trim().slice(0, 255),
      ]
    );
    return BillModel.findByIdAndUser(result.insertId, userId);
  },

  async update(id, userId, { name, amount, dueDate, category, frequency, isPaid, notes }) {
    const existing = await BillModel.findByIdAndUser(id, userId);
    if (!existing) return null;
    const nextName = name !== undefined ? String(name).trim().slice(0, 100) : existing.name;
    const nextAmount = amount !== undefined ? Number(amount) : existing.amount;
    const nextDue = dueDate !== undefined ? dueDate : existing.due_date;
    const nextCat = category !== undefined ? String(category).trim().slice(0, 60) : existing.category;
    const nextFreq = frequency !== undefined ? frequency : existing.frequency;
    const nextPaid = isPaid !== undefined ? (isPaid ? 1 : 0) : existing.is_paid ? 1 : 0;
    const nextNotes = notes !== undefined ? String(notes).trim().slice(0, 255) : existing.notes;

    await pool.execute(
      `UPDATE bills
       SET name = ?, amount = ?, due_date = ?, category = ?, frequency = ?, is_paid = ?, notes = ?
       WHERE id = ? AND user_id = ?`,
      [nextName, nextAmount, nextDue, nextCat, nextFreq, nextPaid, nextNotes, Number(id), Number(userId)]
    );
    return BillModel.findByIdAndUser(id, userId);
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM bills WHERE id = ? AND user_id = ?',
      [Number(id), Number(userId)]
    );
    return result.affectedRows > 0;
  },
};
