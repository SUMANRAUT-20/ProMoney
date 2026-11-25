import test from 'node:test';
import assert from 'node:assert/strict';
import { getDbPool } from '../src/db.js';
import { authController, resetLoginRateLimiter } from '../src/controllers/authController.js';
import { settingsController } from '../src/controllers/settingsController.js';
import { AccountModel } from '../src/models/accountModel.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { BudgetModel } from '../src/models/budgetModel.js';
import { BillModel } from '../src/models/billModel.js';
import { GoalModel } from '../src/models/goalModel.js';
import { CategoryModel } from '../src/models/categoryModel.js';
import { SettingsModel } from '../src/models/settingsModel.js';
import { getDemoCredentials, seedDemoAccount } from '../src/services/demoSeed.js';
import { getAccountTotals } from '../src/services/financeMath.js';
import { buildLaboMessages } from '../src/services/laboChat.js';
import { buildFinanceSnapshot } from '../src/services/laboSnapshot.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, val) {
      this.headers[name.toLowerCase()] = val;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('Real Demo Account (a): demo login succeeds and a LA-BO snapshot builds for the demo user', async () => {
  resetLoginRateLimiter();
  const fixedNow = new Date('2026-11-17T00:00:00Z');
  await seedDemoAccount({ now: fixedNow });

  const { email, password } = getDemoCredentials();
  const loginRes = createMockRes();
  await authController.login(
    {
      body: { email, password },
      headers: {},
      ip: '127.0.0.1',
    },
    loginRes,
    (err) => {
      throw err;
    }
  );

  assert.equal(loginRes.statusCode, 200);
  const demoUser = loginRes.body?.data?.user;
  assert.ok(demoUser?.id, 'Demo login returns real numeric database user id');
  assert.equal(demoUser.email, 'demo@promoney.local');
  assert.equal(demoUser.is_demo, true);

  const setCookie = loginRes.getHeader('set-cookie');
  assert.ok(
    Array.isArray(setCookie)
      ? setCookie.some((c) => c.includes('pm_session=') && c.includes('HttpOnly'))
      : String(setCookie || '').includes('pm_session='),
    'Demo login issues httpOnly pm_session cookie'
  );

  // Load real backend data for the demo user and build LA-BO snapshot (snapshot level only — no AI call)
  const [categories, accounts, transactions, budgets, bills, goals, preferences] = await Promise.all([
    CategoryModel.findByUser(demoUser.id),
    AccountModel.findByUser(demoUser.id),
    TransactionModel.findByUser(demoUser.id),
    BudgetModel.findByUser(demoUser.id),
    BillModel.findByUser(demoUser.id),
    GoalModel.findByUser(demoUser.id),
    SettingsModel.getPreferences(demoUser.id),
  ]);

  const snapshot = buildFinanceSnapshot(
    { categories, accounts, transactions, budgets, bills, goals, preferences },
    '2026-11',
    '2026-11-17'
  );

  assert.equal(snapshot.currency, 'JPY');
  assert.equal(snapshot.income_jpy, 128000);
  assert.equal(snapshot.expense_jpy, 61450);
  assert.equal(snapshot.net_jpy, 66550);
  assert.equal(snapshot.total_balance_all_accounts_jpy, 343813);
  assert.equal(snapshot.budgets.length, 1);
  assert.equal(snapshot.goals.length, 1);

  const messages = buildLaboMessages({
    question: 'How much did I spend this month?',
    snapshot,
  });
  assert.equal(messages.length, 2);
  assert.ok(messages[0].content.includes('343813'));
  assert.ok(messages[0].content.includes('61450'));
});

test('Real Demo Account (b): demo user password and email changes are rejected on the server', async () => {
  const { email, password } = getDemoCredentials();
  const pool = getDbPool();
  const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  const demoUserId = rows[0] ? Number(rows[0].id) : (await seedDemoAccount({ now: new Date('2026-11-17T00:00:00Z') })).userId;

  const pwRes = createMockRes();
  await settingsController.changePassword(
    {
      user: { id: demoUserId, email },
      body: {
        current_password: password,
        new_password: 'AttemptedNewPassword999',
      },
    },
    pwRes,
    (err) => {
      throw err;
    }
  );
  assert.equal(pwRes.statusCode, 403);
  assert.match(pwRes.body?.error || '', /disabled for the shared Demo Account/i);

  const emailRes = createMockRes();
  await settingsController.updateProfile(
    {
      user: { id: demoUserId, email },
      body: {
        display_name: 'Sample Demo Account',
        email: 'changed@promoney.local',
      },
    },
    emailRes,
    (err) => {
      throw err;
    }
  );
  assert.equal(emailRes.statusCode, 403);

  // Confirm original demo password still works
  const loginRes = createMockRes();
  await authController.login(
    {
      body: { email, password },
      headers: {},
      ip: '127.0.0.1',
    },
    loginRes,
    (err) => {
      throw err;
    }
  );
  assert.equal(loginRes.statusCode, 200);
});

test('Real Demo Account (c): seed re-run is idempotent and leaves exactly one canonical demo dataset', async () => {
  const fixedNow = new Date('2026-11-17T00:00:00Z');
  const { email } = getDemoCredentials();
  const pool = getDbPool();
  const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
  const demoUserId = rows[0] ? Number(rows[0].id) : (await seedDemoAccount({ now: fixedNow })).userId;
  const existingAccounts = await AccountModel.findByUser(demoUserId);

  // Mutate the demo account data (simulating QR audience usage)
  await AccountModel.create({
    userId: demoUserId,
    name: 'Temporary Audience Wallet',
    kind: 'cash',
    manualBalance: 99999,
  });
  await TransactionModel.create({
    userId: demoUserId,
    accountId: existingAccounts[0]?.id ?? null,
    categoryId: null,
    kind: 'expense',
    title: 'Temporary audience expense',
    note: 'Temporary audience expense',
    amount: 5000,
    transactionDate: '2026-11-17',
  });

  // Re-run seedDemoAccount — must restore the exact canonical dataset for demo@promoney.local
  const secondRun = await seedDemoAccount({ now: fixedNow });
  assert.equal(secondRun.userId, demoUserId);

  const [userCountRows] = await pool.execute(
    'SELECT COUNT(*) AS n FROM users WHERE email = ?',
    [secondRun.email]
  );
  assert.equal(Number(userCountRows[0].n ?? userCountRows[0].N), 1);

  const [accounts, transactions, budgets, bills, goals] = await Promise.all([
    AccountModel.findByUser(secondRun.userId),
    TransactionModel.findByUser(secondRun.userId),
    BudgetModel.findByUser(secondRun.userId),
    BillModel.findByUser(secondRun.userId),
    GoalModel.findByUser(secondRun.userId),
  ]);

  assert.equal(accounts.length, 4);
  assert.equal(transactions.length, 13);
  assert.equal(budgets.length, 1);
  assert.equal(bills.length, 3);
  assert.equal(goals.length, 1);

  const wiseAcc = accounts.find((a) => a.name === 'WISE');
  const wiseDebit = accounts.find((a) => a.name === 'WISE Master Card');
  assert.ok(wiseAcc);
  assert.ok(wiseDebit);
  assert.equal(wiseDebit.kind, 'debit_card');
  assert.equal(wiseDebit.parent_account_id, wiseAcc.id);

  const totals = getAccountTotals(accounts, transactions);
  assert.equal(totals.held, 343813);
  assert.equal(totals.spendable, 343813);
  assert.equal(totals.net, 343813);
});
