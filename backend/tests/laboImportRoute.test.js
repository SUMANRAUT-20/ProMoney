import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signToken } from '../src/middleware/authMiddleware.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { UserModel } from '../src/models/userModel.js';
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

function preview(request, body, authenticated = true) {
  return request('/labo/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Statement-Format': 'csv',
      ...(!authenticated && { Authorization: '' }),
    },
    body,
  });
}

test('F4: authenticated preview is read-only and Add selected saves and undoes just the checked rows', async (t) => {
  const { request, existing, records } = await importFixture(t);
  const csv = 'Date,Description,Amount\n2026-11-10,Konbini purchase,-850\n2026-11-11,Salary,75000';
  const unauthenticated = await preview(request, csv, false);
  assert.equal(unauthenticated.status, 401);
  await unauthenticated.json();
  const recognized = await preview(request, csv);
  assert.equal(recognized.status, 200);
  const { data: { rows } } = await recognized.json();
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
