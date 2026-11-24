import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import ExcelJS from 'exceljs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { signToken } from '../src/middleware/authMiddleware.js';
import { AccountModel } from '../src/models/accountModel.js';
import { BillModel } from '../src/models/billModel.js';
import { CategoryModel } from '../src/models/categoryModel.js';
import { GoalModel } from '../src/models/goalModel.js';
import { SettingsModel } from '../src/models/settingsModel.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { UserModel } from '../src/models/userModel.js';
import laboRoutes from '../src/routes/laboRoutes.js';
import { addMonthsISO, buildHomeSummary, getCategoryBreakdown, tokyoTodayISO } from '../src/services/financeMath.js';
import { buildFinanceReport, reportRequest } from '../src/services/financeReport.js';
import { parseChatExport } from '../src/services/chatExportRequest.js';
import { getMonthlySummary as reportsPageSummary } from '../../frontend/src/utils/financeMath.js';

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
  assert.deepEqual(reportRequest('can you give me report of last month in pdf', '2026-11-17'), { kind: 'summary', months: [month] });
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
  return { userId: user.id, post, base };
}

test('Chat export parses account, period, type and explicit report sections', () => {
  const parsed = parseChatExport('Export October expenses in CSV, account: Everyday; sections: summary, budgets, goals', {
    format: 'csv', today: '2026-11-24', categories, accounts: [{ id: 4, name: 'Everyday' }],
  });
  assert.deepEqual(parsed, {
    format: 'csv', months: ['2026-10'], categoryIds: [], accountIds: [4], kind: 'expense',
    sections: ['summary', 'budgets', 'goals'],
  });
});

test('Chat downloads a real PDF whose monthly totals match Reports & Insights', async (t) => {
  const { userId, post } = await fixture(t);
  const lastMonth = addMonthsISO(tokyoTodayISO(), -1).slice(0, 7);
  for (const [kind, amount] of [['income', 38000], ['expense', 12600]]) {
    await TransactionModel.create({
      userId, kind, amount, title: kind, transactionDate: lastMonth + '-05',
    });
  }
  const expected = reportsPageSummary(await TransactionModel.findByUser(userId), lastMonth);
  const { data } = await (await post('/chat', { question: 'can you give me report of last month in pdf' })).json();
  assert.equal(data.downloadFormat, 'pdf');
  const pdf = await post('/report/export', { format: data.downloadFormat, report: data.report, signature: data.signature });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-disposition'), /promoney-report\.pdf/);
  const loading = getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
  try {
    const page = await (await loading.promise).getPage(1);
    const text = (await page.getTextContent()).items.map(({ str }) => str).join(' ');
    for (const [label, value] of [['Income', expected.income], ['Expenses', expected.expense], ['Net', expected.net]]) {
      assert.ok(text.includes(`${label} (JPY): ${value.toLocaleString('ja-JP')}`), text);
    }
  } finally {
    await loading.destroy();
  }
});

test('Filtered Excel download contains only owner records and offers the nearest populated month', async (t) => {
  const owner = await fixture(t);
  const other = await fixture(t);
  const categories = await CategoryModel.findByUser(owner.userId);
  for (const [name, title, amount] of [
    ['Food & Dining', 'Lunch sample', 700], ['Transportation', 'Local train sample', 250],
    ['Utilities', 'Outside filter', 999], ['Salary', 'Outside type', 5000],
  ]) {
    const kind = name === 'Salary' ? 'income' : 'expense';
    const category = categories.find((item) => item.name === name && item.kind === kind);
    assert.ok(category, `Missing default category ${name}`);
    await TransactionModel.create({ userId: owner.userId, kind, amount, title,
      categoryId: category.id, transactionDate: '2026-10-12' });
  }
  const question = 'October 2026 expenses in Excel, only Food and Transport';
  const { data } = await (await owner.post('/chat', { question })).json();
  assert.equal(data.downloadFormat, 'xlsx');
  const body = { format: data.downloadFormat, report: data.report, signature: data.signature };
  const response = await owner.post('/report/export', body);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /promoney-report\.xlsx/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(workbook.worksheets.map(({ name }) => name), ['Summary', 'Transactions']);
  const rows = workbook.getWorksheet('Transactions').getRows(2, 2).map((row) => [row.getCell(2).value, row.getCell(6).value]);
  assert.deepEqual(rows.sort(), [['Local train sample', 250], ['Lunch sample', 700]]);
  assert.equal(workbook.getWorksheet('Transactions').rowCount, 3);

  assert.equal((await other.post('/report/export', body)).status, 400);
  assert.equal((await fetch(owner.base + '/report/export', { method: 'POST' })).status, 401);
  const emptyOther = await (await other.post('/chat', { question })).json();
  assert.equal(emptyOther.data.report, undefined);
  const empty = await (await owner.post('/chat', { question: '2026-09 expenses in CSV, only Food and Transport' })).json();
  assert.equal(empty.data.report, undefined);
  assert.match(empty.data.answer, /No matching data for 2026-09.*2026-10/);

  const csvCard = (await (await owner.post('/chat', { question: question.replace('Excel', 'CSV') })).json()).data;
  const csv = await owner.post('/report/export', { format: csvCard.downloadFormat, report: csvCard.report, signature: csvCard.signature });
  assert.match(csv.headers.get('content-type'), /^text\/csv\b/);
  const text = await csv.text();
  assert.match(text, /"Summary"[\s\S]+"Transactions"[\s\S]+Local train sample/);
  assert.doesNotMatch(text, /Outside filter|Outside type/);
});

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
