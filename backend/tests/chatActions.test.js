import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { signToken } from '../src/middleware/authMiddleware.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { UserModel } from '../src/models/userModel.js';
import apiRouter from '../src/routes/index.js';
import { readChatAction } from '../src/services/laboActions.js';
import { tokyoTodayISO } from '../src/services/financeMath.js';
import { makeChatProposal, confirmChatAction } from '../../frontend/src/features/labo/chatActionProposal.js';

async function fixture(t) {
  process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  return async function session() {
    const user = await UserModel.create({
      displayName: 'Chat action test', email: `chat-action-${randomUUID()}@example.test`, passwordHash: null,
    });
    const token = signToken(user);
    return async (path, method = 'GET', body, authenticated = true) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
        method, body: JSON.stringify(body), headers: {
          'Content-Type': 'application/json', ...(authenticated && { Authorization: `Bearer ${token}` }),
        },
      });
      return { ...(await response.json()), status: response.status };
    };
  };
}

const entities = [
  ['account', 'accounts', 'name', { name: 'Train wallet', kind: 'cash', manual_balance: 10000 }],
  ['category', 'categories', 'name', { name: 'Practice materials', kind: 'expense' }],
  ['transaction', 'transactions', 'note', {
    note: 'Rail sample', kind: 'expense', amount: 500, category: 'Transportation',
    account: 'Train wallet', transaction_date: '2026-11-15',
  }, { amount: 600 }],
  ['budget', 'budgets', 'category_name', { category: 'Transportation', budget_month: '2026-11', amount_limit: 20000 }, { amount_limit: 25000 }],
  ['bill', 'bills', 'name', { name: 'Sample mobile', amount: 6000, due_date: '2026-11-30', category: 'Utilities' }, { amount: 7500 }],
  ['goal', 'goals', 'title', { title: 'Train Pass', target_amount: 48000, target_date: '2027-01-31' }, { target_amount: 52000 }],
];

async function actionFinance(request) {
  const mutate = async (path, method, body) => {
    const response = await request(path, method, body);
    assert.ok(response.status < 300, JSON.stringify(response));
    return response.data;
  };
  const lists = Object.fromEntries(await Promise.all(entities.map(async ([, path]) => [path, (await request(path)).data])));
  return {
    ...lists,
    addAccount: (values, ui_details) => mutate('accounts', 'POST', { ...values, ui_details }),
    addTransaction: (values) => mutate('transactions', 'POST', values),
    editTransaction: (id, values) => mutate(`transactions/${id}`, 'PUT', values),
    saveBudget: (values, id) => id ? mutate(`budgets/${id}`, 'PUT', values) : mutate('budgets', 'POST', values),
    removeBudget: (id) => mutate(`budgets/${id}`, 'DELETE'),
    addBill: (values) => mutate('bills', 'POST', values),
    editBill: (id, values) => mutate(`bills/${id}`, 'PUT', values),
    removeBill: (id) => mutate(`bills/${id}`, 'DELETE'),
    addGoal: (values) => mutate('goals', 'POST', values),
    editGoal: (id, values) => mutate(`goals/${id}`, 'PUT', values),
    removeGoal: (id) => mutate(`goals/${id}`, 'DELETE'),
    createCategory: (values) => mutate('categories', 'POST', values),
  };
}

const turn = (content) => Response.json({ choices: [{ message: { content } }] });
const toolTurn = (name, args) => Response.json({ choices: [{ message: {
  tool_calls: [{ type: 'function', function: { name, arguments: JSON.stringify(args) } }],
} }] });

function mockMeta(t, respond) {
  const fetchReal = globalThis.fetch;
  const key = process.env.META_API_KEY;
  const url = process.env.META_API_URL;
  process.env.META_API_KEY = 'fixture-meta';
  process.env.META_API_URL = 'https://api.meta.ai/v1/chat/completions';
  t.after(() => {
    if (key === undefined) delete process.env.META_API_KEY;
    else process.env.META_API_KEY = key;
    if (url === undefined) delete process.env.META_API_URL;
    else process.env.META_API_URL = url;
  });
  t.mock.method(globalThis, 'fetch', (target, options) => (
    target === 'https://api.meta.ai/v1/chat/completions'
      ? respond(JSON.parse(options.body))
      : fetchReal(target, options)
  ));
}

test('Wonder carries the Yamaha R1 goal across turns, explains the target, and proposes the same goal in one shot', async (t) => {
  const session = await fixture(t);
  const owner = await session();
  mockMeta(t, ({ model, messages, tools }) => {
    assert.equal(model, 'muse-wonder-1.0');
    assert.equal(tools.length, 10);
    assert.match(messages[0].content, /explain the term in plain words/);
    const question = messages.at(-1).content;
    if (question === 'create a new goal') return turn('What are you saving for?');
    if (question === 'yahama R1') return turn('What target amount do you want to save for the Yamaha R1?');
    if (question === 'what do you mean?') {
      assert.equal(messages.at(-3).content, 'yahama R1');
      return turn('The target is the full amount you want to save. It lets me show how close you are to buying the Yamaha R1.');
    }
    if (question === '500000') assert.equal(messages.at(-5).content, 'yahama R1');
    if (question === 'I want a Yamaha R1 goal') return toolTurn('propose_goal', { title: 'Yamaha R1', target_amount: 1 });
    return toolTurn('propose_goal', { title: 'Yamaha R1', target_amount: 500000 });
  });
  const history = [];
  for (const question of ['create a new goal', 'yahama R1', 'what do you mean?']) {
    const { data } = await owner('labo/chat', 'POST', { question, history });
    assert.equal(data.action, undefined);
    if (question === 'what do you mean?') assert.match(data.answer, /full amount.*close/);
    history.push({ role: 'user', content: question }, { role: 'assistant', content: data.answer });
  }
  const { data: multi } = await owner('labo/chat', 'POST', { question: '500000', history });
  const { data: one } = await owner('labo/chat', 'POST', { question: 'save 500000 for a Yamaha R1' });
  assert.deepEqual(multi.action, one.action);
  assert.equal((await owner('labo/chat', 'POST', { question: 'I want a Yamaha R1 goal' })).data.action, undefined);
  const finance = await actionFinance(owner);
  const { proposal } = makeChatProposal(one.action, finance);
  assert.equal(proposal.draft.title, 'Yamaha R1');
  assert.equal(proposal.draft.target_amount, 500000);
  assert.deepEqual(finance.goals, []);
  assert.deepEqual((await owner('goals')).data, []);
});

test('Wonder uses the authenticated snapshot, memory and tools, and delete previews still require double confirmation', async (t) => {
  const session = await fixture(t);
  const owner = await session();
  const other = await session();
  const finance = await actionFinance(owner);
  const goal = await finance.addGoal({ title: 'Private goal', target_amount: 87000 });
  const category = finance.categories.find(({ kind }) => kind === 'expense');
  await finance.addTransaction({ kind: 'expense', amount: 18400, title: 'Private entry',
    category_id: category.id, transaction_date: tokyoTodayISO() });
  const remembered = await owner('settings/memory', 'PATCH', { patch: { facts: [{ key: 'hobby', value: 'Private preference' }] } });
  assert.equal(remembered.status, 200);
  const prompts = [];
  mockMeta(t, ({ messages }) => {
    prompts.push(messages[0].content);
    const question = messages.at(-1).content;
    if (question === 'Delete my last record') return toolTurn('propose_delete', { entity: 'goal', target: '#' + goal.id });
    if (question === 'Could you put that in a table?') return toolTurn('get_report', { request: 'by category this month' });
    if (question === 'Could I download that?') return toolTurn('make_export', { format: 'pdf', request: 'transactions this month' });
    return turn('Your expenses this month were ¥18,400.');
  });
  const chat = (request, question, body = {}) => request('labo/chat', 'POST', { question, ...body });
  const question = 'How much did I spend this month?';
  assert.match((await chat(owner, question)).data.answer, /¥18,400/);
  assert.match((await chat(other, question, { userId: goal.user_id, snapshot: { expense_jpy: 18400 } })).data.answer, /couldn't verify/);
  assert.match(prompts[0], /Private preference/);
  assert.doesNotMatch(prompts[1], /Private preference|Private goal|Private entry|18400/);
  assert.equal((await chat(owner, 'Could you put that in a table?')).data.report.hasData, true);
  assert.equal((await chat(other, 'Could you put that in a table?')).data.report.hasData, false);
  const downloadable = (await chat(owner, 'Could I download that?')).data;
  assert.equal(downloadable.downloadFormat, 'pdf');
  assert.equal((await chat(other, 'Could I download that?')).data.report, undefined);
  assert.equal((await other('labo/report/export', 'POST', {
    format: 'pdf', report: downloadable.report, signature: downloadable.signature,
  })).status, 400);
  assert.equal((await chat(other, 'Delete my last record')).data.action, undefined);
  const { data } = await chat(owner, 'Delete my last record');
  const latest = await actionFinance(owner);
  const { proposal } = makeChatProposal(data.action, latest);
  assert.equal(proposal.record.id, goal.id);
  assert.deepEqual(await confirmChatAction(proposal, proposal.draft, latest, latest.createCategory, 'confirmed'), { needsDeleteConfirmation: true });
  assert.ok((await owner('goals')).data.some(({ id }) => id === goal.id));
  await confirmChatAction(proposal, proposal.draft, latest, latest.createCategory, 'delete-confirmed');
  assert.equal((await owner('goals')).data.length, 0);
  const promptCount = prompts.length;
  const upload = await chat(owner, "i'll uplode the xls file can you access whole file tabs and add all transistion in my accounts?");
  assert.match(upload.data.answer, /save the old \.xls file as \.xlsx/i);
  assert.equal(upload.data.action, undefined);
  assert.equal(prompts.length, promptCount);
});

test('Action preview whitelists fields and only keeps monetary amounts present in the request', () => {
  const raw = JSON.stringify({ entity: 'goal', operation: 'create', values: {
    title: 'Train Pass', target_amount: 48000, monthly_plan: 2027,
    target_date: '2027-01-31', user_id: 999,
  } });
  assert.deepEqual(readChatAction(raw, 'Create goal Train Pass for ¥48,000, due 2027-01-31'), {
    entity: 'goal', operation: 'create', target: '',
    values: { title: 'Train Pass', target_amount: 48000, target_date: '2027-01-31' },
  });
  assert.equal(readChatAction('{"entity":"account","operation":"delete"}', 'Delete account'), null);
});

test('Six chat proposals use the page APIs only after confirmation and stay isolated per user', async (t) => {
  const session = await fixture(t);
  const owner = await session();
  const other = await session();
  assert.equal((await owner('labo/actions/preview', 'POST', { text: 'Create a bill' }, false)).status, 401);

  for (const [entity, path, nameKey, values, changes] of entities) {
    const label = values[nameKey] || values.category;
    let finance = await actionFinance(owner);
    const { proposal, question } = makeChatProposal({ entity, operation: 'create', values }, finance);
    assert.ok(proposal, question);
    const count = finance[path].length;
    assert.deepEqual(await confirmChatAction(proposal, proposal.draft, finance, finance.createCategory, 'cancelled'), { saved: false });
    assert.equal((await owner(path)).data.length, count);
    assert.deepEqual(await confirmChatAction(proposal, proposal.draft, finance, finance.createCategory, 'confirmed'), { saved: true });
    finance = await actionFinance(owner);
    assert.equal(finance[path].length, count + 1);
    const created = finance[path].find((row) => row[nameKey] === label);
    assert.ok(created, `Expected ${entity} to appear on its page endpoint`);
    assert.ok(!(await other(path)).data.some((row) => row.id === created.id));

    if (!changes) continue;
    const { proposal: edit, question: editQuestion } = makeChatProposal({ entity, operation: 'edit', target: label, values: changes }, finance);
    assert.ok(edit, editQuestion);
    await confirmChatAction(edit, edit.draft, finance, finance.createCategory, 'confirmed');
    const updated = (await owner(path)).data.find((row) => row.id === created.id);
    for (const [key, value] of Object.entries(changes)) assert.equal(updated[key], value);
    assert.equal((await other(`${path}/${created.id}`, 'PUT', changes)).status, 404);

    if (entity === 'transaction') continue;
    const latest = await actionFinance(owner);
    const { proposal: deletion } = makeChatProposal({ entity, operation: 'delete', target: label, values: {} }, latest);
    assert.deepEqual(await confirmChatAction(deletion, deletion.draft, latest, latest.createCategory, 'confirmed'), { needsDeleteConfirmation: true });
    assert.ok((await owner(path)).data.some((row) => row.id === created.id));
    assert.equal((await other(`${path}/${created.id}`, 'DELETE')).status, 404);
    await confirmChatAction(deletion, deletion.draft, latest, latest.createCategory, 'delete-confirmed');
    assert.ok(!(await owner(path)).data.some((row) => row.id === created.id));
  }
});

test('Ambiguous records and duplicate budget creates cannot mutate the stored budget', async (t) => {
  const session = await fixture(t);
  const owner = await session();
  let finance = await actionFinance(owner);
  const category = finance.categories.find((item) => item.name === 'Transportation');
  for (const budget_month of ['2026-10', '2026-11']) {
    await finance.saveBudget({ category_id: category.id, amount_limit: 1000, budget_month });
  }
  finance = await actionFinance(owner);
  const result = makeChatProposal({
    entity: 'budget', operation: 'delete', target: 'Transportation', values: {},
  }, finance);
  assert.equal(result.proposal, undefined);
  assert.match(result.question, /^Which budget/);
  const duplicate = await owner('budgets', 'POST', {
    category_id: category.id, amount_limit: 5000, budget_month: '2026-11', create_only: true,
  });
  assert.equal(duplicate.status, 409);
  assert.ok((await owner('budgets')).data.every((budget) => budget.amount_limit === 1000));
});
