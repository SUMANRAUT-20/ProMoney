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

const [rows] = await connection.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
  [process.env.DB_NAME || 'promoney']
);
console.log('Tables ready:', rows.map((r) => r.table_name ?? r.TABLE_NAME).join(', '));
await connection.end();
