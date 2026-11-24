import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { signToken } from '../src/middleware/authMiddleware.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { UserModel } from '../src/models/userModel.js';
import apiRouter from '../src/routes/index.js';
import { buildFinanceReport } from '../src/services/financeReport.js';
import { buildFinanceSnapshot } from '../../frontend/src/features/labo/buildSnapshot.js';

async function categoryFixture(t) {
  process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  return async () => {
    const user = await UserModel.create({
      displayName: 'Categories Test', email: `categories-${randomUUID()}@example.com`, passwordHash: null,
    });
    const token = signToken(user);
    return async (path, method = 'GET', body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { ...await response.json(), status: response.status };
    };
  };
}

test('Category names are unique across kinds and case per user, and defaults are protected', async (t) => {
  const createUser = await categoryFixture(t);
  const userA = await createUser();
  const userB = await createUser();
  const { data: defaults } = await userA('/categories');
  const health = defaults.find((category) => category.name === 'Health');
  assert.equal(health.kind, 'expense');
  assert.equal(health.is_default, true);
  assert.equal((await userA(`/categories/${health.id}`, 'PUT', { name: 'New name' })).status, 403);
  assert.equal((await userA(`/categories/${health.id}`, 'DELETE')).status, 403);
  assert.equal((await userA('/categories', 'POST', { name: ' ', kind: 'expense' })).status, 400);

  const creators = await Promise.all([
    userA('/categories', 'POST', { name: ' Cycling ', kind: 'expense' }),
    userA('/categories', 'POST', { name: 'CYCLING', kind: 'income' }),
  ]);
  assert.deepEqual(creators.map(({ status }) => status).sort(), [201, 409]);
  const { data: custom } = creators.find(({ status }) => status === 201);
  assert.equal(custom.is_default, false);
  assert.equal((await userA(`/categories/${custom.id}`, 'PUT', { name: 'hEALTh' })).status, 409);
  assert.ok(!(await userB('/categories')).data.some((category) => category.name.toLowerCase() === 'cycling'));
  assert.equal((await userB(`/categories/${custom.id}`, 'PUT', { name: 'Stolen' })).status, 404);
  assert.equal((await userB(`/categories/${custom.id}`, 'DELETE')).status, 404);
  assert.equal((await userB('/categories', 'POST', { name: 'Cycling', kind: 'expense' })).status, 201);
});

test('Custom category is usable in transactions and budgets, reports track renames, and deletion keeps transactions', async (t) => {
  const createUser = await categoryFixture(t);
  const request = await createUser();
  const { data: custom } = await request('/categories', 'POST', { name: 'Music lessons', kind: 'expense' });
  assert.ok((await request('/categories')).data.some((category) => category.id === custom.id));
  const day = '2026-11-12';
  const month = day.slice(0, 7);
  const { status, data: expense } = await request('/transactions', 'POST', {
    kind: 'expense', amount: 3000, note: 'Lesson', category_id: custom.id, transaction_date: day,
  });
  assert.equal(status, 201);
  assert.equal(expense.category_name, custom.name);
  assert.equal((await request('/budgets', 'POST', { category_id: custom.id, amount_limit: 4000, budget_month: month })).status, 200);
  const rename = await request(`/categories/${custom.id}`, 'PUT', { name: 'Piano lessons' });
  assert.equal(rename.status, 200);
  const { data: transactions } = await request('/transactions');
  const { data: categories } = await request('/categories');
  const { data: budgets } = await request('/budgets');
  assert.equal(transactions[0].category_name, 'Piano lessons');
  assert.equal(budgets[0].category_name, 'Piano lessons');
  assert.deepEqual(buildFinanceReport({ kind: 'categories', months: [month], transactions, categories }).rows[0], ['Piano lessons', 3000]);
  const snapshot = buildFinanceSnapshot({ transactions, categories, budgets, accounts: [], bills: [], goals: [] }, month, day);
  assert.equal(snapshot.top_expense_categories[0].name, 'Piano lessons');

  assert.equal((await request(`/categories/${custom.id}`, 'DELETE')).status, 200);
  const { data: remaining } = await request('/transactions');
  assert.deepEqual(remaining, [{ ...transactions[0], category_id: null, category_name: null }]);
  const report = buildFinanceReport({ kind: 'categories', months: [month], transactions: remaining, categories });
  assert.deepEqual(report.rows[0], ['Uncategorized', 3000]);
});
