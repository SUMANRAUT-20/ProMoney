import { getDbPool } from '../db.js';
import { cleanMemory, forgetMemoryEntry, mergeMemory } from '../services/nidhiMemory.js';

const pool = getDbPool();

function parseMemory(raw) {
  try {
    return cleanMemory(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    return cleanMemory();
  }
}

async function readMemory(store, userId, lock = false) {
  const [[row]] = await store.execute(
    `SELECT nidhi_memory_json FROM user_settings WHERE user_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [Number(userId)],
  );
  return parseMemory(row?.nidhi_memory_json);
}

async function updateMemory(userId, change) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT IGNORE INTO user_settings (user_id) VALUES (?)', [Number(userId)]);
    const next = change(await readMemory(connection, userId, true));
    if (next) {
      await connection.execute('UPDATE user_settings SET nidhi_memory_json = ? WHERE user_id = ?',
        [JSON.stringify(next), Number(userId)]);
    }
    await connection.commit();
    return next;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export const MemoryModel = {
  findByUser: (userId) => userId ? readMemory(pool, userId) : Promise.resolve(cleanMemory()),
  merge: (userId, patch) => updateMemory(userId, (current) => mergeMemory(current, patch)),
  forget: (userId, section, key) => updateMemory(userId, (current) => forgetMemoryEntry(current, section, key)),
  async clear(userId) {
    await pool.execute('UPDATE user_settings SET nidhi_memory_json = NULL WHERE user_id = ?', [Number(userId)]);
  },
  async seedDemo(connection, userId) {
    const sample = cleanMemory({
      style: { languageMix: 'English and Roman Nepali', messageLength: 'Short' },
      facts: [{ key: 'budget focus', value: 'Review monthly food spending' }],
      wordMap: { khana: 'Food & Dining' },
      merchantMap: { 'family mart': 'Food & Dining' },
      patterns: { payday: 25 },
      summary: 'Prefers short, everyday explanations.',
    });
    await connection.execute('UPDATE user_settings SET nidhi_memory_json = ? WHERE user_id = ?',
      [JSON.stringify(sample), Number(userId)]);
  },
};
