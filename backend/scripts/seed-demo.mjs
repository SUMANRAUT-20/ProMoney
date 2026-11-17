/**
 * Idempotent Demo Account Seed Script (feat/demo-real-account)
 *
 * Creates or resets ONLY the single demo user (DEMO_EMAIL, default demo@promoney.local)
 * in TiDB with the canonical sample dataset (accounts including WISE + its linked
 * WISE Master Card debit tag, 13 transactions, 1 budget, 3 bills, 1 goal, and settings).
 *
 * Usage:
 *   node scripts/seed-demo.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '..', '.env') });

const { seedDemoAccount } = await import('../src/services/demoSeed.js');
const { getDbPool } = await import('../src/db.js');

try {
  const result = await seedDemoAccount();
  console.log(
    `Demo user seeded: ${result.email} (id=${result.userId}) — ` +
      `${result.counts.accounts} accounts, ${result.counts.transactions} transactions, ` +
      `${result.counts.budgets} budget, ${result.counts.bills} bills, ${result.counts.goals} goal.`
  );
} finally {
  await getDbPool().end();
}
