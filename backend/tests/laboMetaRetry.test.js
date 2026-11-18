import assert from 'node:assert/strict';
import test from 'node:test';
import { askLabo, askGroq, metaComplete, scanReceiptWithLabo, META_MAX_COMPLETION_TOKENS } from '../src/services/laboChat.js';

const truncated = { choices: [{ finish_reason: 'length', message: { content: null } }] };
const complete = { choices: [{ finish_reason: 'stop', message: { content: 'Hello!' } }] };
const env = { AI_PROVIDER: 'meta', META_API_KEY: 'fixture-meta-key' };
const messages = [{ role: 'user', content: 'Hello' }];

test('Meta chat retries an empty length-truncated completion once with twice the raised cap', async (t) => {
  const logging = t.mock.method(console, 'warn', () => {});
  const requests = [];
  const result = await askLabo({
    question: 'Hello', snapshot: {}, env,
    fetchImpl: async (url, init) => {
      requests.push({ url, headers: init.headers, ...JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => requests.length === 1 ? truncated : complete };
    },
  });
  assert.equal(result.answer, 'Hello!');
  assert.equal(META_MAX_COMPLETION_TOKENS, 3000);
  assert.deepEqual(requests.map(({ max_tokens }) => max_tokens), [3000, 6000]);
  assert.deepEqual(requests[1], { ...requests[0], max_tokens: 6000 });
  assert.equal(logging.mock.callCount(), 1);
  assert.deepEqual(logging.mock.calls[0].arguments, [
    '[LA-BO provider retry]', 'meta', 200,
    'Empty length-truncated completion. Retrying once with max_tokens', 6000,
  ]);
});

test('Meta stops after one empty length retry and keeps the upstream error and diagnostic logging', async (t) => {
  const retryLog = t.mock.method(console, 'warn', () => {});
  const failureLog = t.mock.method(console, 'error', () => {});
  let calls = 0;
  await assert.rejects(() => metaComplete(messages, {
    apiKey: env.META_API_KEY,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => truncated };
    },
  }), { code: 'META_UPSTREAM', message: 'Meta API returned an empty answer.' });
  assert.equal(calls, 2);
  assert.equal(retryLog.mock.callCount(), 1);
  assert.deepEqual(failureLog.mock.calls[0].arguments, [
    '[LA-BO provider error]', 'meta', 200, JSON.stringify(truncated),
  ]);
});

test('Meta returns visible content immediately and never retries empty completions with other finish reasons', async (t) => {
  t.mock.method(console, 'error', () => {});
  const retryLog = t.mock.method(console, 'warn', () => {});
  for (const [content, finishReason] of [['Hello!', 'length'], [null, 'stop'], ['', 'content_filter']]) {
    let calls = 0;
    const attempt = metaComplete(messages, {
      apiKey: env.META_API_KEY,
      fetchImpl: async () => {
        calls += 1;
        return { ok: true, status: 200, json: async () => ({
          choices: [{ finish_reason: finishReason, message: { content } }],
        }) };
      },
    });
    if (content) assert.equal(await attempt, content);
    else await assert.rejects(attempt, { code: 'META_UPSTREAM' });
    assert.equal(calls, 1);
  }
  assert.equal(retryLog.mock.callCount(), 0);
});

test('Groq keeps its original cap and single-attempt behavior for empty length completions', async (t) => {
  t.mock.method(console, 'error', () => {});
  const requests = [];
  await assert.rejects(() => askGroq({
    question: 'Hello', snapshot: {}, apiKey: 'fixture-groq-key',
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => truncated };
    },
  }), { code: 'GROQ_UPSTREAM' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].max_tokens, 800);
});

test('Meta vision uses the raised cap and preserves the image when retrying', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const requests = [];
  const imageDataUrl = 'data:image/png;base64,ZmFrZQ==';
  const result = await scanReceiptWithLabo({
    imageDataUrl, categories: [{ id: 1, name: 'Food', kind: 'expense' }], today: '2026-11-18', env,
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => requests.length === 1 ? truncated : {
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
          action: 'add', kind: 'expense', amount: 500, category_name: 'Food',
          transaction_date: '2026-11-18', note: 'Lunch',
        }) } }],
      } };
    },
  });
  assert.deepEqual(requests.map(({ max_tokens }) => max_tokens), [3000, 6000]);
  assert.deepEqual(requests[1], { ...requests[0], max_tokens: 6000 });
  assert.equal(requests[1].messages[1].content[1].image_url.url, imageDataUrl);
  assert.equal(result.proposal.amount, 500);
});
