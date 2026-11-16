// LA-BO chat tests — prompt rules, Meta (primary) & Groq (fallback)
// provider routing, Q1 number verification, and controller validation.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLaboMessages,
  buildParseMessages,
  extractProposal,
  askGroq,
  askMeta,
  askLabo,
  getActiveProvider,
  verifyAnswerNumbers,
  LABO_MODEL,
  META_MODEL,
} from '../src/services/laboChat.js';
import { laboController } from '../src/controllers/laboController.js';

const snapshot = {
  month: '2026-11',
  income_jpy: 85000,
  expense_jpy: 48500,
  top_category: { name: 'Groceries', amount_jpy: 18000 }
};

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}
const next = (err) => { if (err) throw err; };

test('buildLaboMessages embeds the snapshot numbers and the no-inventing rule', () => {
  const messages = buildLaboMessages({ question: 'How much did I spend?', snapshot });
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Never invent/);
  assert.match(messages[0].content, /data_status/);
  assert.match(messages[0].content, /Transactions page/);
  assert.match(messages[0].content, /Roman Nepali/);
  assert.match(messages[0].content, /SAME language/);
  assert.match(messages[0].content, /48500/);
  assert.equal(messages[1].content, 'How much did I spend?');
});

test('askGroq posts to Groq with the labo model and returns the answer text', async () => {
  let seenUrl = '';
  let seenInit = null;
  const fakeFetch = async (url, init) => {
    seenUrl = url;
    seenInit = init;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'You spent ¥48,500.' } }] })
    };
  };
  const answer = await askGroq({ question: 'How much?', snapshot, apiKey: 'test-key', fetchImpl: fakeFetch });
  assert.equal(answer, 'You spent ¥48,500.');
  assert.match(seenUrl, /api\.groq\.com/);
  assert.equal(seenInit.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(seenInit.body).model, LABO_MODEL);
});

test('askGroq rejects clearly when Groq answers with an error status', async () => {
  const fakeFetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(
    () => askGroq({ question: 'Hi', snapshot, apiKey: 'k', fetchImpl: fakeFetch }),
    (err) => err.code === 'GROQ_UPSTREAM' && err.status === 429
  );
});

test('askMeta posts to Meta Model API (Llama 4) and askLabo routes by AI_PROVIDER + enforces Q1', async () => {
  assert.equal(getActiveProvider({}), 'meta');
  assert.equal(getActiveProvider({ AI_PROVIDER: 'meta' }), 'meta');
  assert.equal(getActiveProvider({ AI_PROVIDER: 'groq' }), 'groq');

  let seenUrl = '';
  let seenBody = null;
  const fakeMetaFetch = async (url, init) => {
    seenUrl = url;
    seenBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'This month you spent ¥48,500, with ¥18,000 on Groceries.' } }],
      }),
    };
  };

  const metaRes = await askLabo({
    question: 'How much did I spend?',
    snapshot,
    env: { AI_PROVIDER: 'meta', META_API_KEY: 'meta-test-key' },
    fetchImpl: fakeMetaFetch,
  });
  assert.equal(metaRes.provider, 'meta');
  assert.equal(metaRes.model, META_MODEL);
  assert.match(seenUrl, /api\.meta\.ai\/v1\/chat\/completions/);
  assert.equal(seenBody.model, META_MODEL);
  assert.match(metaRes.answer, /¥48,500/);

  // Constitution Q1: fabricated JPY amount not in snapshot is refused
  const checkOk = verifyAnswerNumbers('You spent ¥48,500 out of ¥85,000 income.', snapshot);
  assert.equal(checkOk.valid, true);
  const checkBad = verifyAnswerNumbers('You spent ¥999,999 this month.', snapshot);
  assert.equal(checkBad.valid, false);
  assert.deepEqual(checkBad.mismatchedNumbers, [999999]);
});

test('laboController validates input before calling the AI', async () => {
  const res1 = mockRes();
  await laboController.chat({ body: { question: '  ', snapshot } }, res1, next);
  assert.equal(res1.statusCode, 400);

  const res2 = mockRes();
  await laboController.chat({ body: { question: 'Hi' } }, res2, next);
  assert.equal(res2.statusCode, 400);
});

const parseCategories = [
  { id: 'groceries', name: 'Groceries', kind: 'expense' },
  { id: 'transportation', name: 'Transportation', kind: 'expense' },
  { id: 'other-expense', name: 'Other Expense', kind: 'expense' },
  { id: 'part-time-salary', name: 'Part-time Salary', kind: 'income' },
  { id: 'other-income', name: 'Other Income', kind: 'income' }
];

test('buildParseMessages carries the categories and the JSON-only rule', () => {
  const messages = buildParseMessages({ text: 'khana 1200', categories: parseCategories, today: '2026-11-09' });
  assert.match(messages[0].content, /ONLY a JSON object/);
  assert.match(messages[1].content, /Groceries/);
  assert.match(messages[1].content, /2026-11-09/);
});

test('extractProposal accepts a clean add and maps the category id', () => {
  const raw = '{"action":"add","kind":"expense","amount":1200,"category_name":"Groceries","transaction_date":"2026-11-09","note":"khana"}';
  const proposal = extractProposal(raw, parseCategories, '2026-11-09');
  assert.deepEqual(proposal, {
    kind: 'expense',
    amount: 1200,
    category_id: 'groceries',
    category_name: 'Groceries',
    transaction_date: '2026-11-09',
    note: 'khana'
  });
});

test('extractProposal tolerates fences, falls back to Other, and fixes a bad date', () => {
  const raw = '```json\n{"action":"add","kind":"expense","amount":"800","category_name":"Spaceship","transaction_date":"tomorrow","note":"x"}\n```';
  const proposal = extractProposal(raw, parseCategories, '2026-11-09');
  assert.equal(proposal.amount, 800);
  assert.equal(proposal.category_name, 'Other Expense');
  assert.equal(proposal.transaction_date, '2026-11-09');
});

test('extractProposal returns null for questions and bad amounts', () => {
  assert.equal(extractProposal('{"action":"none"}', parseCategories, '2026-11-09'), null);
  assert.equal(extractProposal('{"action":"add","kind":"expense","amount":-5,"category_name":"Groceries"}', parseCategories, '2026-11-09'), null);
  assert.equal(extractProposal('not json at all', parseCategories, '2026-11-09'), null);
});

test('laboController.parse validates input and the missing-key case', async () => {
  const res1 = mockRes();
  await laboController.parse({ body: { text: '', categories: parseCategories } }, res1, next);
  assert.equal(res1.statusCode, 400);

  const savedGroq = process.env.GROQ_API_KEY;
  const savedMeta = process.env.META_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.META_API_KEY;
  try {
    const res2 = mockRes();
    await laboController.parse({ body: { text: 'khana 1200', categories: parseCategories } }, res2, next);
    assert.equal(res2.statusCode, 503);
  } finally {
    if (savedGroq !== undefined) process.env.GROQ_API_KEY = savedGroq;
    if (savedMeta !== undefined) process.env.META_API_KEY = savedMeta;
  }
});

test('laboController returns 503 when the active provider API key is missing', async () => {
  const savedGroq = process.env.GROQ_API_KEY;
  const savedMeta = process.env.META_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.META_API_KEY;
  try {
    const res = mockRes();
    await laboController.chat({ body: { question: 'How much did I spend?', snapshot } }, res, next);
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /not configured/);
  } finally {
    if (savedGroq !== undefined) process.env.GROQ_API_KEY = savedGroq;
    if (savedMeta !== undefined) process.env.META_API_KEY = savedMeta;
  }
});
