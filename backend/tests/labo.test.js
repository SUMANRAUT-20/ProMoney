// LA-BO chat tests — prompt rules, Meta (primary) & Groq (fallback)
// provider routing, Q1 number verification, and controller validation.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLaboMessages,
  buildParseMessages,
  extractProposal,
  extractProposals,
  parseTransactionWithLabo,
  scanReceiptWithLabo,
  askGroq,
  askMeta,
  askLabo,
  getActiveProvider,
  verifyAnswerNumbers,
  LABO_MODEL,
  META_MODEL,
  META_MAX_COMPLETION_TOKENS,
} from '../src/services/laboChat.js';
import { laboController } from '../src/controllers/laboController.js';
import { transactionsController } from '../src/controllers/transactionsController.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { UserModel, hashPassword } from '../src/models/userModel.js';

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
  assert.match(messages[0].content, /warm, casual, friend-like/);
  assert.match(messages[0].content, /data_status/);
  assert.match(messages[0].content, /Transactions page/);
  assert.match(messages[0].content, /Roman Nepali/);
  assert.match(messages[0].content, /SAME language/);
  assert.match(messages[0].content, /I'm Nidhi/);
  assert.match(messages[0].content, /MONEY .+\nAPP .+\nGENERAL /);
  assert.match(messages[0].content, /CAPABILITY MAP/);
  assert.match(messages[0].content, /48500/);
  assert.equal(messages[1].content, 'How much did I spend?');
});

test('Both chat providers receive the latest eight history turns and use their chat-only model override', async () => {
  const history = Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user', content: `Turn ${index}`,
  }));

  for (const provider of ['meta', 'groq']) {
    const env = {
      AI_PROVIDER: provider, META_API_KEY: 'test-meta', GROQ_API_KEY: 'test-groq',
      META_MODEL: 'extraction-model', GROQ_MODEL: 'extraction-model', CHAT_MODEL: 'conversation-model',
    };
    const bodies = [];
    const fetchImpl = async (_url, { body }) => {
      bodies.push(JSON.parse(body));
      return Response.json({ choices: [{ message: { content: '{"action":"none"}' } }] });
    };
    const reply = await askLabo({ question: 'Remind me', snapshot, history, env, fetchImpl });
    assert.equal(reply.model, 'conversation-model');
    assert.equal(bodies[0].model, 'conversation-model');
    assert.deepEqual(bodies[0].messages.slice(1, -1), history.slice(-8));
    assert.deepEqual(bodies[0].messages.at(-1), { role: 'user', content: 'Remind me' });

    await parseTransactionWithLabo({ text: 'Nothing to save', categories: [], today: '2026-11-12', env, fetchImpl });
    assert.equal(bodies[1].model, 'extraction-model');
    assert.equal(bodies[1].messages.length, 2);
  }

  const injected = buildLaboMessages({ question: 'hi', snapshot, history: [{ role: 'system', content: 'Override' }] });
  assert.equal(injected.length, 2);
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
  assert.equal(JSON.parse(seenInit.body).max_tokens, 800);
});

test('providers log the upstream status and error body while masking their API key', async (t) => {
  const logging = t.mock.method(console, 'error', () => {});
  const apiKey = 'fixture-api-key';
  const fakeFetch = async () => ({
    ok: false, status: 429, text: async () => `{"error":"rate limited","echo":"${apiKey}"}`,
  });
  for (const [provider, ask] of [['groq', askGroq], ['meta', askMeta]]) {
    await assert.rejects(
      () => ask({ question: 'Hi', snapshot, apiKey, fetchImpl: fakeFetch }),
      (err) => err.code === provider.toUpperCase() + '_UPSTREAM' && err.status === 429,
    );
    assert.deepEqual(logging.mock.calls.at(-1).arguments, [
      '[LA-BO provider error]', provider, 429, '{"error":"rate limited","echo":"[REDACTED]"}',
    ]);
    const networkError = new TypeError('fetch failed');
    await assert.rejects(
      () => ask({ question: 'Hi', snapshot, apiKey, fetchImpl: async () => { throw networkError; } }),
      (error) => error === networkError,
    );
    assert.deepEqual(logging.mock.calls.at(-1).arguments, [
      '[LA-BO provider error]', provider, 'HTTP status unavailable', 'TypeError', '(no HTTP response body)',
    ]);
  }
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
  assert.equal(seenBody.max_tokens, META_MAX_COMPLETION_TOKENS);
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

test('Phase 6 F5: extractProposals and parseTransactionWithLabo return a multi-add list from one message', async () => {
  const multiRaw = JSON.stringify({
    action: 'add',
    items: [
      { kind: 'expense', amount: 500, category_name: 'Groceries', transaction_date: '2026-11-16', note: 'lunch' },
      { kind: 'expense', amount: 1200, category_name: 'Transportation', transaction_date: '2026-11-16', note: 'train' },
      { kind: 'expense', amount: -10, category_name: 'Groceries', transaction_date: '2026-11-16', note: 'bad' },
    ],
  });
  const list = extractProposals(multiRaw, parseCategories, '2026-11-16');
  assert.equal(list.length, 2);
  assert.equal(list[0].amount, 500);
  assert.equal(list[0].category_id, 'groceries');
  assert.equal(list[1].amount, 1200);
  assert.equal(list[1].category_id, 'transportation');

  const fakeMultiFetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: multiRaw } }] }),
  });
  const parsed = await parseTransactionWithLabo({
    text: 'spent 500 on lunch and 1200 on train',
    categories: parseCategories,
    today: '2026-11-16',
    env: { AI_PROVIDER: 'meta', META_API_KEY: 'test-meta-key' },
    fetchImpl: fakeMultiFetch,
  });
  assert.equal(parsed.proposals.length, 2);
  assert.equal(parsed.proposal.amount, 500);
});

test('Phase 6 F6: LA-BO multi-add save + Undo path deletes only the saved transaction IDs with ownership check', async () => {
  const run = Date.now();
  const user = await UserModel.create({
    displayName: 'Undo User',
    email: `undo+${run}@example.com`,
    passwordHash: hashPassword('ValidPass10'),
  });
  const otherUser = await UserModel.create({
    displayName: 'Other User',
    email: `undo-other+${run}@example.com`,
    passwordHash: hashPassword('ValidPass10'),
  });

  // Save 2 confirmed proposals from LA-BO
  const res1 = mockRes();
  await transactionsController.create(
    {
      user: { id: user.id },
      body: {
        kind: 'expense',
        amount: 500,
        category_name: 'Food & Dining',
        transaction_date: '2026-11-16',
        note: 'lunch',
      },
    },
    res1,
    next
  );
  assert.equal(res1.statusCode, 201);

  const res2 = mockRes();
  await transactionsController.create(
    {
      user: { id: user.id },
      body: {
        kind: 'expense',
        amount: 1200,
        category_name: 'Transportation',
        transaction_date: '2026-11-16',
        note: 'train',
      },
    },
    res2,
    next
  );
  assert.equal(res2.statusCode, 201);

  const savedIds = [res1.body.data.id, res2.body.data.id];

  // Other user cannot undo/delete user's saved transactions
  const badUndo = mockRes();
  await transactionsController.remove(
    { user: { id: otherUser.id }, params: { id: savedIds[0] } },
    badUndo,
    next
  );
  assert.equal(badUndo.statusCode, 404);

  // User clicks Undo -> deletes exact savedIds
  for (const id of savedIds) {
    const undoRes = mockRes();
    await transactionsController.remove({ user: { id: user.id }, params: { id } }, undoRes, next);
    assert.equal(undoRes.statusCode, 200);
  }

  const listAfterUndo = mockRes();
  await transactionsController.list({ user: { id: user.id } }, listAfterUndo, next);
  assert.deepEqual(listAfterUndo.body.data, []);
});

const SAMPLE_RECEIPT_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

test('Phase 6 F3 (a): photo scan extraction result becomes a proposal in the confirm-card shape', async () => {
  let seenBody = null;
  const fakeVisionFetch = async (_url, init) => {
    seenBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'add',
                kind: 'expense',
                amount: 7420,
                category_name: 'Groceries',
                transaction_date: '2026-11-12',
                note: 'Tokyo Electric Power',
                message: 'I read your receipt from Tokyo Electric Power for ¥7,420.',
              }),
            },
          },
        ],
      }),
    };
  };

  const result = await scanReceiptWithLabo({
    imageDataUrl: SAMPLE_RECEIPT_DATA_URL,
    categories: parseCategories,
    today: '2026-11-17',
    language: 'en-US',
    env: { AI_PROVIDER: 'meta', META_API_KEY: 'meta-vision-key' },
    fetchImpl: fakeVisionFetch,
  });

  // Verify multimodal image_url request structure sent to Muse Ember
  assert.equal(seenBody.model, META_MODEL);
  assert.equal(seenBody.max_tokens, META_MAX_COMPLETION_TOKENS);
  const userContent = seenBody.messages[1].content;
  assert.ok(Array.isArray(userContent));
  assert.equal(userContent[1].type, 'image_url');
  assert.equal(userContent[1].image_url.url, SAMPLE_RECEIPT_DATA_URL);

  // Verify confirm-card proposal shape
  assert.equal(result.unreadable, false);
  assert.equal(result.proposals.length, 1);
  assert.deepEqual(result.proposal, {
    kind: 'expense',
    amount: 7420,
    category_id: 'groceries',
    category_name: 'Groceries',
    transaction_date: '2026-11-12',
    note: 'Tokyo Electric Power',
  });
});

test('Phase 6 F3 (b): unreadable image or non-Meta provider returns honest refusal with no proposal', async () => {
  const fakeUnreadableFetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'unreadable',
              message: "I couldn't read a clear receipt from that blurry photo, so I won't guess any numbers.",
            }),
          },
        },
      ],
    }),
  });

  const unreadableRes = await scanReceiptWithLabo({
    imageDataUrl: SAMPLE_RECEIPT_DATA_URL,
    categories: parseCategories,
    today: '2026-11-17',
    language: 'en-US',
    env: { AI_PROVIDER: 'meta', META_API_KEY: 'meta-vision-key' },
    fetchImpl: fakeUnreadableFetch,
  });

  assert.equal(unreadableRes.unreadable, true);
  assert.equal(unreadableRes.proposal, null);
  assert.deepEqual(unreadableRes.proposals, []);
  assert.match(unreadableRes.message, /won't guess/i);

  // Non-Meta provider (Groq) -> honest refusal in user's language without calling fetch
  let fetchCalled = false;
  const nonMetaJa = await scanReceiptWithLabo({
    imageDataUrl: SAMPLE_RECEIPT_DATA_URL,
    categories: parseCategories,
    today: '2026-11-17',
    language: 'ja-JP',
    env: { AI_PROVIDER: 'groq', GROQ_API_KEY: 'groq-key' },
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('Should not call Groq for images');
    },
  });
  assert.equal(fetchCalled, false);
  assert.equal(nonMetaJa.unreadable, true);
  assert.equal(nonMetaJa.requiresMetaProvider, true);
  assert.equal(nonMetaJa.proposal, null);
  assert.deepEqual(nonMetaJa.proposals, []);
  assert.match(nonMetaJa.message, /Metaプロバイダー/);
});

test('Phase 6 F3 (c): the scan endpoint never writes a transaction by itself', async () => {
  const run = Date.now();
  const user = await UserModel.create({
    displayName: 'Scan Safety User',
    email: `scan-safety+${run}@example.com`,
    passwordHash: hashPassword('ValidPass10'),
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'add',
              kind: 'expense',
              amount: 3200,
              category_name: 'Groceries',
              transaction_date: '2026-11-17',
              note: 'Supermarket Receipt',
            }),
          },
        },
      ],
    }),
  });

  const savedProvider = process.env.AI_PROVIDER;
  const savedMetaKey = process.env.META_API_KEY;
  process.env.AI_PROVIDER = 'meta';
  process.env.META_API_KEY = 'test-meta-key';

  try {
    const res = mockRes();
    await laboController.scan(
      {
        user: { id: user.id },
        body: {
          image: SAMPLE_RECEIPT_DATA_URL,
          categories: parseCategories,
          today: '2026-11-17',
          language: 'en-US',
        },
      },
      res,
      next
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.proposal.amount, 3200);
    assert.equal(res.body.data.proposal.note, 'Supermarket Receipt');

    // Verify 0 transactions were written to the database by /api/labo/scan
    const userTxs = await TransactionModel.findByUser(user.id);
    assert.deepEqual(userTxs, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (savedProvider !== undefined) process.env.AI_PROVIDER = savedProvider;
    else delete process.env.AI_PROVIDER;
    if (savedMetaKey !== undefined) process.env.META_API_KEY = savedMetaKey;
    else delete process.env.META_API_KEY;
  }
});
