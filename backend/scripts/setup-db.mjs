/**
 * One-time database setup: creates the database (if needed) and all tables
 * from backend/sql/schema.sql, using the connection values in backend/.env.
 *
 * Run once after creating a fresh MySQL/TiDB database:
 *   node scripts/setup-db.mjs
 * Safe to re-run: every statement uses IF NOT EXISTS or column checks.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });
const schema = await readFile(path.join(here, '..', 'sql', 'schema.sql'), 'utf8');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ...(process.env.DB_SSL === 'true'
    ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }
    : {}),
});

const statements = schema
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const statement of statements) {
  await connection.query(statement);
}

const dbName = process.env.DB_NAME || 'promoney';

async function hasColumn(tableName, columnName) {
  const [cols] = await connection.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [dbName, tableName, columnName]
  );
  return Number(cols[0].n ?? cols[0].N) > 0;
}

// Migration 003 (Google Sign-In): password_hash nullable + google_sub column.
await connection.query(
  `ALTER TABLE \`${dbName}\`.users MODIFY COLUMN password_hash VARCHAR(255) NULL`
);
if (!(await hasColumn('users', 'google_sub'))) {
  await connection.query(
    `ALTER TABLE \`${dbName}\`.users ADD COLUMN google_sub VARCHAR(255) NULL`
  );
  await connection.query(
    `ALTER TABLE \`${dbName}\`.users ADD UNIQUE KEY unique_google_sub (google_sub)`
  );
  console.log('Migration 003 applied: google_sub column added.');
}

// Migration 005 (Phase 2 Layer 1 Engine): accounts.kind/ui_details, transactions.kind/to_account_id/note.
await connection.query(
  `ALTER TABLE \`${dbName}\`.accounts MODIFY COLUMN kind VARCHAR(30) NOT NULL DEFAULT 'cash'`
);
if (!(await hasColumn('accounts', 'ui_details'))) {
  await connection.query(
    `ALTER TABLE \`${dbName}\`.accounts ADD COLUMN ui_details JSON NULL`
  );
  console.log('Migration 005 applied: accounts.ui_details column added.');
}

await connection.query(
  `ALTER TABLE \`${dbName}\`.transactions MODIFY COLUMN kind VARCHAR(30) NOT NULL`
);
if (!(await hasColumn('transactions', 'to_account_id'))) {
  await connection.query(
    `ALTER TABLE \`${dbName}\`.transactions ADD COLUMN to_account_id BIGINT UNSIGNED NULL`
  );
  console.log('Migration 005 applied: transactions.to_account_id column added.');
}
if (!(await hasColumn('transactions', 'note'))) {
  await connection.query(
    `ALTER TABLE \`${dbName}\`.transactions ADD COLUMN note VARCHAR(255) NULL`
  );
  console.log('Migration 005 applied: transactions.note column added.');
}

const [rows] = await connection.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
  [dbName]
);
console.log('Tables ready:', rows.map((r) => r.table_name ?? r.TABLE_NAME).join(', '));

await connection.end();
