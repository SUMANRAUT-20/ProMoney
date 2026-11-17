import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { signToken } from '../src/middleware/authMiddleware.js';
import { AccountModel } from '../src/models/accountModel.js';
import { BillModel } from '../src/models/billModel.js';
import { CategoryModel } from '../src/models/categoryModel.js';
import { GoalModel } from '../src/models/goalModel.js';
import { SettingsModel } from '../src/models/settingsModel.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { UserModel } from '../src/models/userModel.js';
import laboRoutes from '../src/routes/laboRoutes.js';
import { buildHomeSummary, getCategoryBreakdown, tokyoTodayISO } from '../src/services/financeMath.js';
import { buildFinanceReport, reportRequest } from '../src/services/financeReport.js';

const month = '2026-10';
const categories = [{ id: 1, name: 'Food & Dining' }, { id: 2, name: 'Transportation' }];
const transactions = [
  { category_id: 1, kind: 'expense', amount: 1800, transaction_date: '2026-10-08' },
  { category_id: 1, kind: 'refund', amount: 200, transaction_date: '2026-10-22' },
  { category_id: 2, kind: 'expense', amount: 700, transaction_date: '2026-10-09' },
  { category_id: 2, kind: 'transfer', amount: 4500, transaction_date: '2026-10-09' },
  { category_id: 1, kind: 'expense', amount: 500, transaction_date: '2026-11-01' },
];

test('F7: category report uses the financeMath breakdown for the requested month', () => {
  const request = reportRequest('spending by category last month', '2026-11-17');
  assert.deepEqual(request, { kind: 'categories', months: [month] });
  const report = buildFinanceReport({ ...request, transactions, categories });
  const expected = getCategoryBreakdown(transactions, month, categories);
  assert.deepEqual(report.rows, [...expected.items.map(({ name, amount }) => [name, amount]), ['Total', expected.totalExpense]]);
  assert.deepEqual(reportRequest('last month vs this month', '2027-01-17').months, ['2026-12', '2027-01']);
  assert.deepEqual(reportRequest('show my income vs expense October 2026').months, [month]);
});

async function fixture(t) {
  process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
  const user = await UserModel.create({
    displayName: 'LA-BO Reports Test',
    email: `labo-report+${randomUUID()}@example.com`,
    passwordHash: null,
  });
  const app = express();
  app.use(express.json());
  app.use('/labo', laboRoutes);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/labo`;
  const post = (path, body) => fetch(base + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${signToken(user)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { userId: user.id, post };
}

test('F7: CSV and PDF export the same card even after its source data changes', async (t) => {
  const { userId, post } = await fixture(t);
  const category = await CategoryModel.create({ userId, name: '食費', kind: 'expense' });
  const addExpense = (amount) => TransactionModel.create({
    userId, categoryId: category.id, kind: 'expense', title: 'Groceries', amount, transactionDate: month + '-10',
  });
  await addExpense(1800);
  const chat = await post('/chat', { question: `spending by category ${month}` });
  assert.equal(chat.status, 200);
  const { data: { report, signature } } = await chat.json();
  assert.deepEqual(report.rows, [['食費', 1800], ['Total', 1800]]);
  await addExpense(9999);
  const csv = await post('/report/export', { format: 'csv', report, signature });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /^text\/csv\b/);
  assert.deepEqual((await csv.text()).trim().split('\r\n').slice(2), report.rows.map(([label, amount]) => `"${label}",${amount}`));
  const pdf = await post('/report/export', { format: 'pdf', report, signature });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /^application\/pdf\b/);
  assert.match(Buffer.from(await pdf.arrayBuffer()).subarray(0, 8).toString('ascii'), /^%PDF-/);
  const changed = await post('/report/export', { format: 'csv', report: { ...report, rows: [['Total', 1]] }, signature });
  assert.equal(changed.status, 400);
  await changed.json();
});

test('F8: chat returns the current Home warnings verbatim in engine order', async (t) => {
  const { userId, post } = await fixture(t);
  const bill = await BillModel.create({ userId, name: 'Rent #1', amount: 1800, dueDate: tokyoTodayISO() });
  const preferences = await SettingsModel.getPreferences(userId);
  const expected = buildHomeSummary({ bills: [bill], preferences }).warnings.map(({ title }) => title);
  assert.ok(expected.includes('Rent #1 is due today'));
  const response = await post('/chat', { question: 'any alerts?' });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data.warnings, expected);
});

test('LA-BO simulation responses leave finances unchanged', async (t) => {
  const { userId, post } = await fixture(t);
  const account = await AccountModel.create({ userId, name: 'Bank', kind: 'bank', manualBalance: 6000 });
  const goal = await GoalModel.create({ userId, title: 'Trip', targetAmount: 3000, monthlyPlan: 1000 });
  const purchase = await post('/chat', { question: 'Can I buy a ¥1,000 jacket?' });
  assert.equal(purchase.status, 200);
  assert.equal((await purchase.json()).data.purchase.amount, 1000);
  const allocation = await post('/chat', { question: 'What can I do with my money?' });
  assert.equal(allocation.status, 200);
  assert.equal((await allocation.json()).data.allocation.proposals[0].kind, 'goal');
  const scenario = await post('/what-if', { moreIncome: 500, lessSpending: 0 });
  assert.equal(scenario.status, 200);
  assert.equal((await scenario.json()).data.scenarioTrend.length, 3);
  assert.deepEqual(await TransactionModel.findByUser(userId), []);
  assert.equal((await GoalModel.findByIdAndUser(goal.id, userId)).saved_amount, 0);
  assert.equal((await AccountModel.findByIdAndUser(account.id, userId)).manual_balance, 6000);
});
