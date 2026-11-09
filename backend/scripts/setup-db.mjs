/**
 * One-time database setup: creates the database (if needed) and all tables
 * from backend/sql/schema.sql, using the connection values in backend/.env.
 *
 * Run once after creating a fresh MySQL/TiDB database:
 *   node scripts/setup-db.mjs
 * Safe to re-run: every statement uses IF NOT EXISTS.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const here = path.dirname(fileURLToPath(import.meta.url));
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

// Strip "--" comment lines first: a ";" inside a comment would otherwise
// split a statement in the wrong place.
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
const [rows] = await connection.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
  [dbName]
);
console.log('Tables ready:', rows.map((r) => r.table_name ?? r.TABLE_NAME).join(', '));

// Migration 003 (Google Sign-In): password_hash nullable + google_sub column.
// Idempotent: MODIFY is safe to repeat; the column add is checked first.
await connection.query(
  `ALTER TABLE \`${dbName}\`.users MODIFY COLUMN password_hash VARCHAR(255) NULL`
);
const [cols] = await connection.query(
  `SELECT COUNT(*) AS n FROM information_schema.columns
   WHERE table_schema = ? AND table_name = 'users' AND column_name = 'google_sub'`,
  [dbName]
);
if (Number(cols[0].n ?? cols[0].N) === 0) {
  // Two separate statements: TiDB cannot add a column and an index on
  // that same new column in a single ALTER TABLE.
  await connection.query(
    `ALTER TABLE \`${dbName}\`.users ADD COLUMN google_sub VARCHAR(255) NULL`
  );
  await connection.query(
    `ALTER TABLE \`${dbName}\`.users ADD UNIQUE KEY unique_google_sub (google_sub)`
  );
  console.log('Migration 003 applied: google_sub column added.');
}
await connection.end();
