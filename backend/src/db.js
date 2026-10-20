import mysql from 'mysql2/promise';

// ONLY enable once MySQL is configured in Phase 3.
// Do not call this from server.js until the team is ready for database work.
export function createDbPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'promoney',
    waitForConnections: true,
    connectionLimit: 5,
    decimalNumbers: true,
  });
}
