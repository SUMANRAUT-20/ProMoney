import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import ExcelJS from 'exceljs';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signToken } from '../src/middleware/authMiddleware.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { UserModel } from '../src/models/userModel.js';
import { getAccountBalance } from '../src/services/financeMath.js';
import apiRouter from '../src/routes/index.js';
import { saveSelectedStatementRows } from '../../frontend/src/features/labo/saveSelectedStatementRows.js';

async function importFixture(t) {
  process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
  const user = await UserModel.create({
    displayName: 'Statement Import Test',
    email: `statement-import+${randomUUID()}@example.com`,
    passwordHash: null,
  });
  const existing = await TransactionModel.create({
    userId: user.id,
    kind: 'expense',
    title: 'Konbini purchase',
    amount: 850,
    transactionDate: '2026-11-10',
  });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', apiRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = signToken(user);
  const request = (path, options = {}) => fetch(base + path, {
    ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  const records = () => TransactionModel.findByUser(user.id);
  return { request, existing, records };
}

function preview(request, body, authenticated = true, format = 'csv') {
  return request('/labo/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Statement-Format': format,
      ...(!authenticated && { Authorization: '' }),
    },
    body,
  });
}

async function sendJson(request, path, method, body, expected) {
  const response = await request(path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  assert.equal(response.status, expected, payload.error);
  return payload.data;
}

async function teamLayoutWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const layout = [
    ['Demo Bank', 'Transfer', 'Income', 'Salary', 44, 1000],
    ['Demo Cash', 'Cash', 'Expense', 'Groceries', 55, 300],
    ['Demo Credit Card', 'Credit Card', 'Expense', 'Healthcare', 33, 700],
  ];
  const sheets = ['January', 'February', 'March'].map((month) => {
    const sheet = workbook.addWorksheet(month);
    sheet.addRow(['Date', 'Type', 'Category', 'Account', 'Description', 'Amount (JPY)', 'Payment Method', 'Notes / Scenario']);
    return sheet;
  });
  for (const [label, method, kind, category, count, amount] of layout) {
    for (let index = 0; index < count; index += 1) {
      const month = index % sheets.length;
      const day = String(1 + Math.floor(index / sheets.length)).padStart(2, '0');
      const variant = label === 'Demo Bank' && index % 2 ? ' DEMO BANK ' : label;
      sheets[month].addRow([`2026-0${month + 1}-${day}`, kind, category, variant, `Purchase ${index + 1}`, amount, method, 'Fixture note']);
    }
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

test('F4: authenticated preview is read-only and Add selected saves and undoes just the checked rows', async (t) => {
  const { request, existing, records } = await importFixture(t);
  const csv = 'Date,Description,Amount\n2026-11-10,Konbini purchase,-850\n2026-11-11,Salary,75000';
  const unauthenticated = await preview(request, csv, false);
  assert.equal(unauthenticated.status, 401);
  await unauthenticated.json();
  const recognized = await preview(request, csv);
  assert.equal(recognized.status, 200);
  const { data: { rows, accountGroups } } = await recognized.json();
  assert.equal(accountGroups, null);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(({ possibleDuplicate, selected }) => [possibleDuplicate, selected]), [
    [true, false],
    [false, true],
  ]);
  assert.ok(rows[1].category_id);
  assert.deepEqual((await records()).map((row) => row.id), [existing.id]);

  const { savedIds, error } = await saveSelectedStatementRows(rows, async (body) => {
    const response = await request('/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 201);
    return (await response.json()).data;
  }, null);
  assert.equal(error, null);
  assert.equal(savedIds.length, 1);
  assert.deepEqual((await records()).map((row) => row.note), ['Salary', 'Konbini purchase']);
  const undone = await request(`/transactions/${savedIds[0]}`, { method: 'DELETE' });
  assert.equal(undone.status, 200);
  await undone.json();
  assert.deepEqual((await records()).map((row) => row.id), [existing.id]);
});

test('F4: unknown CSV columns are rejected without saving a transaction', async (t) => {
  const { request, existing, records } = await importFixture(t);
  const unrecognized = await preview(request, 'Date,Details,Balance\n2026-11-10,Konbini,95000');
  assert.equal(unrecognized.status, 422);
  const error = await unrecognized.json();
  assert.match(error.error, /recogniz|column|header/i);
  assert.equal(error.data, undefined);
  assert.deepEqual((await records()).map((row) => row.id), [existing.id]);
});

test('Statement imports infer Health for English and Japanese medical expenses', async (t) => {
  const { request, records, existing } = await importFixture(t);
  const descriptions = ['Hospital expenses', 'Medical fees', 'Pharmacy', 'Clinic', '病院', '薬局', '医療'];
  const csv = ['Date,Description,Amount', ...descriptions.map((name) => `2026-11-12,${name},-1000`)].join('\n');
  const response = await preview(request, csv);
  assert.equal(response.status, 200);
  const { data: { rows } } = await response.json();
  assert.equal(rows.length, descriptions.length);
  assert.ok(rows.every((row) => row.category_name === 'Health' && row.category_id));
  assert.deepEqual((await records()).map((row) => row.id), [existing.id]);
});

test('Team-layout workbook asks once per file account, saves to three accounts, and remembers approved mappings', async (t) => {
  const { request, records } = await importFixture(t);
  const other = await importFixture(t);
  const workbook = await teamLayoutWorkbook();
  const read = async (user = request) => {
    const response = await preview(user, workbook, true, 'xlsx');
    assert.equal(response.status, 200);
    return (await response.json()).data;
  };
  const first = await read();
  assert.equal(first.rows.length, 132);
  assert.deepEqual(first.accountGroups.map(({ label, count, suggestedGroup, accountId }) => [label, count, suggestedGroup, accountId]), [
    ['Demo Bank', 44, 'bank', ''], ['Demo Cash', 55, 'cash', ''], ['Demo Credit Card', 33, 'credit', ''],
  ]);
  assert.equal(first.rows.find((row) => row.categoryLabel === 'Healthcare').category_name, 'Health');
  assert.equal(first.rows.find((row) => row.accountLabel === 'Demo Credit Card').paymentMethod, 'Credit Card');

  const accounts = [];
  for (const [name, kind] of [['Checking', 'bank'], ['Wallet', 'cash'], ['Credit Account', 'credit_card']]) {
    accounts.push(await sendJson(request, '/accounts', 'POST', { name, kind, manual_balance: 0 }, 201));
  }
  const accountMap = Object.fromEntries(first.accountGroups.map((group, index) => [group.key, accounts[index].id]));
  await sendJson(other.request, '/settings/memory', 'PATCH', { patch: { accountMap } }, 400);
  await sendJson(request, '/settings/memory', 'PATCH', { patch: { accountMap } }, 200);
  const second = await read();
  assert.deepEqual(second.accountGroups.map(({ accountId, remembered }) => [accountId, remembered]),
    accounts.map(({ id }) => [String(id), true]));
  assert.ok((await read(other.request)).accountGroups.every((group) => !group.accountId));

  const { savedIds, error } = await saveSelectedStatementRows(second.rows, (body) =>
    sendJson(request, '/transactions', 'POST', body, 201), (row) => accountMap[row.accountGroup]);
  assert.equal(error, null);
  assert.equal(savedIds.length, 132);
  const transactions = await records();
  assert.deepEqual(accounts.map(({ id }) => transactions.filter((row) => row.account_id === id).length), [44, 55, 33]);
  assert.deepEqual(accounts.map((account) => getAccountBalance(account, transactions, null, accounts)), [44000, -16500, 23100]);
  assert.ok(transactions.filter((row) => row.account_id === accounts[2].id).every((row) => row.category_name === 'Health'));
  assert.ok((await read()).rows.every((row) => row.possibleDuplicate && !row.selected));

  assert.equal((await request('/settings/memory/accountMap/demo%20bank', { method: 'DELETE' })).status, 200);
  assert.equal((await read()).accountGroups[0].accountId, '');
  const exact = await sendJson(request, '/accounts', 'POST', { name: 'demo Bank', kind: 'bank', manual_balance: 0 }, 201);
  const exactGroup = (await read()).accountGroups[0];
  assert.equal(exactGroup.accountId, String(exact.id));
  assert.equal(exactGroup.remembered, false);
});

test('Reviewed transactions persist distinct titles, optional notes, corrected dates, and account overrides', async (t) => {
  const { request, records } = await importFixture(t);
  const [bank, cash] = await Promise.all([
    sendJson(request, '/accounts', 'POST', { name: 'Bank', kind: 'bank', manual_balance: 0 }, 201),
    sendJson(request, '/accounts', 'POST', { name: 'Cash', kind: 'cash', manual_balance: 0 }, 201),
  ]);
  const response = await preview(request, 'Date,Description,Amount\n2026-11-12,First,-120\n2026-11-13,Second,-250');
  const { data } = await response.json();
  assert.equal(data.accountGroups, null);
  const [first, second] = data.rows;
  const edited = [
    { ...first, title: 'Edited title', note: 'Separate note', transaction_date: '2026-11-14', amount: '400', account_id: String(cash.id) },
    { ...second, title: 'Second title', note: '' },
  ];
  const result = await saveSelectedStatementRows(edited, (body) => sendJson(request, '/transactions', 'POST', body, 201), bank.id);
  assert.equal(result.error, null);
  const saved = (await records()).filter((row) => result.savedIds.includes(row.id));
  assert.deepEqual(saved.map(({ title, note, transaction_date, amount, account_id }) => [title, note, transaction_date, amount, account_id]), [
    ['Edited title', 'Separate note', '2026-11-14', 400, cash.id], ['Second title', '', '2026-11-13', 250, bank.id],
  ]);
  const updated = await sendJson(request, `/transactions/${saved[0].id}`, 'PUT', { amount: 500 }, 200);
  assert.deepEqual([updated.title, updated.note, updated.amount], ['Edited title', 'Separate note', 500]);
});
