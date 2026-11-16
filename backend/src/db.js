import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '..', '.env') });

// Cloud databases (TiDB Cloud, Aiven) require TLS: set DB_SSL=true in .env.
// Local MySQL/MariaDB does not need it, so it stays off by default.
function createDbPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'promoney',
    waitForConnections: true,
    connectionLimit: 5,
    decimalNumbers: true,
    ...(process.env.DB_SSL === 'true'
      ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }
      : {}),
  });
}

let sharedPool = null;

/** Shared singleton pool for the models (one pool per process). */
export function getDbPool() {
  if (!sharedPool) sharedPool = createDbPool();
  return sharedPool;
}
