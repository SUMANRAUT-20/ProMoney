import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { getDbPool } from '../src/db.js';
import { AccountModel } from '../src/models/accountModel.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { UserModel } from '../src/models/userModel.js';
import { previewStatement } from '../src/controllers/statementImportController.js';
import { transactionsController } from '../src/controllers/transactionsController.js';
import { parseStatementImport } from '../src/services/statementImport.js';
import { parseStatementXlsx } from '../src/services/statementXlsx.js';
import { saveSelectedStatementRows, statementReviewNet } from '../../frontend/src/features/labo/saveSelectedStatementRows.js';
import { dummyTemplateBytes } from './fixtures/dummyTemplate.js';
import { messyExtraction, messyStatementBytes } from './fixtures/messyStatement.js';

const metaEnv = {
  AI_PROVIDER: 'groq', GROQ_API_KEY: 'unused', META_API_KEY: 'fixture',
  META_API_URL: 'https://api.meta.ai/v1/chat/completions', META_MODEL: 'contributor',
};
const categories = [
  { id: 1, name: 'Health', kind: 'expense' }, { id: 2, name: 'Salary', kind: 'income' },
  { id: 3, name: 'Transportation', kind: 'expense' },
];
const complete = (result) => ({ ok: true, status: 200, json: async () => ({
  choices: [{ message: { content: JSON.stringify(result) } }],
  usage: { prompt_tokens: 110, completion_tokens: 90, total_tokens: 200 },
}) });
const unused = () => assert.fail('The provider must not be invoked for a clean sheet');
const discardUsage = () => {};
const next = (error) => { if (error) throw error; };
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(value) { this.value = value; return this; },
});
after(() => getDbPool().end());

test('The corrected template and sheets at the 90% threshold stay on the exact code path', async () => {
  const logs = [];
  const options = { categories, env: metaEnv, fetchImpl: unused, logUsage: (_, usage) => logs.push(usage) };
  const template = await parseStatementImport(await dummyTemplateBytes({ invalidDate: false }), 'xlsx', options);
  assert.equal(template.rows.length, 2);
  assert.deepEqual(template.sheets.filter((sheet) => sheet.found).map((sheet) => sheet.parseMethod), ['exact', 'exact']);
  const csv = ['Date,Description,Amount', ...Array(9).fill('2026-11-12,Train,-250'), '2026-11-13,Trip,unknown'].join('\n');
  const result = await parseStatementImport(Buffer.from(csv), 'csv', options);
  assert.equal(result.rows.length, 9);
  assert.equal(result.sheets[0].parseMethod, 'exact');
  assert.equal(result.sheets[0].skipped, 1);
  assert.ok(result.warnings[0].includes('amount must be whole JPY'));
  assert.deepEqual(logs.map(({ requests, totalTokens }) => [requests, totalTokens]), [[0, 0], [0, 0]]);
});

test('Recognized calendar warnings and annual totals never send the team workbook to Meta', async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await dummyTemplateBytes());
  workbook.getWorksheet('02 Feb').getRow(17).values = [
    '2026-02-31', 'Expense', 'Utilities', 'Demo Cash', 'Water bill', 2200, 'Cash',
  ];
  const aggregate = workbook.getWorksheet('YEAR SUMMARY');
  aggregate.getRow(4).values = ['Month', 'Income (JPY)', 'Expenses (JPY)', 'Surplus (JPY)', 'Transactions'];
  aggregate.getRow(5).values = ['01 Jan', 50000, 40000, 10000, 2];
  aggregate.getRow(6).values = ['02 Feb', 75000, 9000, 66000, 3];

  const logs = [];
  const result = await parseStatementImport(Buffer.from(await workbook.xlsx.writeBuffer()), 'xlsx', {
    categories, env: metaEnv, fetchImpl: unused, logUsage: (_, usage) => logs.push(usage),
  });
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.sheets.filter(({ found }) => found).map(({ name, parseMethod }) => [name, parseMethod]), [
    ['01 Jan', 'exact'], ['02 Feb', 'exact'],
  ]);
  assert.deepEqual(result.sheets.find(({ name }) => name === '02 Feb'), {
    name: '02 Feb', found: 3, skipped: 2, reasons: [{ reason: 'Invalid calendar date', count: 2 }],
    note: null, parseMethod: 'exact',
  });
  assert.deepEqual(result.warnings, ['02 Feb, row 16: Invalid calendar date.', '02 Feb, row 17: Invalid calendar date.']);
  for (const name of ['START HERE', 'REFERENCE LISTS', 'YEAR SUMMARY']) {
    const sheet = result.sheets.find((entry) => entry.name === name);
    assert.equal(sheet.note, 'No transaction table');
    assert.equal(sheet.parseMethod, undefined);
  }
  assert.equal(logs[0].requests, 0);
});

test('Messy XLSX sends the source rows only to standard Ember and records provider token usage', async () => {
  const fixture = await messyStatementBytes();
  await assert.rejects(parseStatementXlsx(fixture), { code: 'STATEMENT_UNREADABLE' });
  const calls = [];
  const logs = [];
  const result = await parseStatementImport(fixture, 'xlsx', {
    categories, env: metaEnv, logUsage: (_, usage) => logs.push(usage),
    fetchImpl: async (url, options) => {
      calls.push({ url, request: JSON.parse(options.body) });
      return complete(messyExtraction);
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).hostname, 'api.meta.ai');
  assert.equal(calls[0].request.model, 'muse-ember-1.0');
  const dump = JSON.parse(calls[0].request.messages[1].content);
  assert.equal(dump.headers[0][1][0], '店名・摘要欄');
  assert.deepEqual(dump.data.map(([number]) => number), [2, 3, 4, 5, 6]);
  assert.deepEqual(logs, [{ format: 'xlsx', requests: 1, responsesWithUsage: 1, inputTokens: 110, outputTokens: 90, totalTokens: 200 }]);
  assert.deepEqual(result.sheets[0], {
    name: 'Unsorted export', found: 5, skipped: 1, reasons: [{ reason: 'AI could not read the source row', count: 1 }],
    note: null, parseMethod: 'ai', cleaned: 4, toCheck: 2,
  });
  assert.deepEqual(result.rows.map(({ transaction_date, amount, kind }) => [transaction_date, amount, kind]), [
    ['2026-11-10', 1250, 'expense'], ['2026-11-11', 250000, 'income'],
    ['2026-11-13', 850, 'expense'], ['', null, 'expense'],
  ]);
  assert.equal(statementReviewNet(result.rows), 247900);
  assert.equal(result.rows[2].uncertain, true);
  assert.equal(result.rows[3].aiCategoryId, null);
  assert.match(result.warnings[0], /row 6.*could not read/);
});

test('The real import review reuses account matching and blocks confirmed rows with invalid dates', async (t) => {
  const priorKey = process.env.META_API_KEY;
  process.env.META_API_KEY = 'fixture';
  t.after(() => {
    if (priorKey === undefined) delete process.env.META_API_KEY;
    else process.env.META_API_KEY = priorKey;
  });
  t.mock.method(globalThis, 'fetch', async () => complete(messyExtraction));
  const user = await UserModel.create({ displayName: 'Clean import test', email: randomUUID() + '@example.com', passwordHash: null });
  const bank = await AccountModel.create({ userId: user.id, name: 'Demo Bank', kind: 'bank' });
  const cash = await AccountModel.create({ userId: user.id, name: 'Demo Cash', kind: 'cash' });
  const preview = response();
  await previewStatement({ user, body: await messyStatementBytes(), get: () => 'xlsx' }, preview, next);
  assert.equal(preview.statusCode, 200);
  const { rows, accountGroups } = preview.value.data;
  assert.deepEqual(accountGroups.map(({ count, accountId }) => [count, accountId]), [[2, String(bank.id)], [2, String(cash.id)]]);
  assert.deepEqual(rows.map(({ selected, category_name }) => [selected, category_name]), [
    [true, 'Health'], [true, 'Salary'], [false, 'Transportation'], [false, null],
  ]);
  assert.deepEqual(await TransactionModel.findByUser(user.id), []);
  const selected = [rows[0], rows[1], { ...rows[2], selected: true }, { ...rows[3], selected: true }];
  const invalid = await saveSelectedStatementRows(selected, () => assert.fail('No invalid row or earlier row should save'), bank.id);
  assert.match(invalid.error.message, /Row 4 \(Mystery charge\).*valid calendar date/);
  const reviewed = selected.slice(0, 3).map((row) => ({ ...row, title: row.note, note: row.importNote }));
  const accountIds = new Map(accountGroups.map(({ key, accountId }) => [key, accountId]));
  const saved = await saveSelectedStatementRows(reviewed, async (body) => {
    const result = response();
    await transactionsController.create({ user, body }, result, next);
    assert.equal(result.statusCode, 201);
    return result.value.data;
  }, (row) => accountIds.get(row.accountGroup));
  assert.equal(saved.error, null);
  assert.equal(saved.savedIds.length, 3);
  const stored = await TransactionModel.findByUser(user.id);
  assert.deepEqual(stored.map(({ title, note, account_id }) => [title, note, account_id]), [
    ['Train ticket', 'Trip', cash.id], ['Payroll', 'November pay', bank.id], ['Shinjuku clinic', 'Receipt available', bank.id],
  ]);
});

test('A Meta outage keeps the code rows and explains what was skipped', async () => {
  const csv = 'Date,Description,Amount\n2026-11-12,Train,-250\n2026-02-30,Trip,-500\n2026-11-13,Food,unknown';
  const logs = [];
  const result = await parseStatementImport(Buffer.from(csv), 'csv', {
    categories, env: metaEnv, logUsage: (_, usage) => logs.push(usage),
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].amount, 250);
  assert.equal(result.sheets[0].parseMethod, 'fallback');
  assert.equal(result.sheets[0].skipped, 2);
  assert.match(result.sheets[0].note, /AI cleaning was unavailable/);
  assert.match(result.warnings.join(' '), /Invalid calendar date.*whole JPY/);
  assert.equal(logs[0].requests, 1);
});

test('The 200-row cap keeps later code-parsed rows and reports unsent rows', async () => {
  const csv = ['Date,Description,Amount', ...Array(200).fill('bad date,Trip,-300'), '2026-11-13,Train,-250', 'bad date,Other,-100'].join('\n');
  const result = await parseStatementImport(Buffer.from(csv), 'csv', {
    categories, env: metaEnv, logUsage: discardUsage,
    fetchImpl: async (_, options) => {
      assert.equal(JSON.parse(JSON.parse(options.body).messages[1].content).data.length, 200);
      return complete({ rows: [], skipped: [] });
    },
  });
  assert.deepEqual(result.rows.map(({ note }) => note), ['Train']);
  assert.equal(result.sheets[0].skipped, 201);
  assert.ok(result.sheets[0].reasons.some(({ reason, count }) => reason.includes('200-row') && count === 1));
});
