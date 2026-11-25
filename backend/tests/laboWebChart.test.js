import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import { loadImage } from '@napi-rs/canvas';
import express from 'express';
import { signToken } from '../src/middleware/authMiddleware.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { AccountModel } from '../src/models/accountModel.js';
import { CategoryModel } from '../src/models/categoryModel.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { UserModel } from '../src/models/userModel.js';
import laboRoutes from '../src/routes/laboRoutes.js';
import { getCategoryBreakdown, tokyoTodayISO } from '../src/services/financeMath.js';
import { requestsSpendingChart } from '../src/services/laboChart.js';
import { canSearchWeb, LIVE_WEB_TOOL, searchLiveWeb } from '../src/services/tavilySearch.js';
import { conversationHistory } from '../src/services/laboConversation.js';

const META = 'https://api.meta.ai/v1/chat/completions';
const TAVILY = 'https://api.tavily.com/search';
const fixtureKey = 'tvly-test-only';
const source = { title: 'Public release notes', url: 'https://example.test/release', content: 'The current price is ¥52,000.' };
const searchReply = () => Response.json({ answer: source.content, results: [source, { ...source, url: 'javascript:alert(1)' }] });
const toolTurn = () => Response.json({ choices: [{ message: {
  tool_calls: [{ function: { name: LIVE_WEB_TOOL, arguments: '{"query":"Private account balance"}' } }],
} }] });
const textTurn = (content) => Response.json({ choices: [{ message: { content } }] });

function setEnvironment(t, values) {
  const before = Object.keys(values).map((key) => [key, process.env[key]]);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function fixture(t, { meta, tavily, key = fixtureKey } = {}) {
  setEnvironment(t, { META_API_URL: META, META_API_KEY: 'meta-test', TAVILY_API_KEY: key });
  process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
  const app = express();
  app.use(express.json());
  app.use('/labo', laboRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const realFetch = globalThis.fetch;
  const logs = [];
  const realInfo = console.info;
  t.mock.method(console, 'info', (event, data) => {
    if (event === '[Nidhi Tavily]') logs.push(data);
    else realInfo(event, data);
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === META && meta) return meta(JSON.parse(options.body));
    if (url === TAVILY && tavily) return tavily(options);
    assert.equal(url, origin + '/labo/chat', 'Only the local test server can use real fetch');
    return realFetch(url, options);
  });
  return {
    logs,
    async session() {
      const user = await UserModel.create({ displayName: 'Web chart fixture', email: randomUUID() + '@example.test', passwordHash: null });
      return { userId: user.id, async chat(question) {
        const response = await fetch(origin + '/labo/chat', {
          method: 'POST', headers: { Authorization: `Bearer ${signToken(user)}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        assert.equal(response.status, 200);
        return (await response.json()).data;
      } };
    },
  };
}

test('Wonder searches an external question with Tavily and returns a dated LIVE WEB answer with sources', async (t) => {
  const question = 'What is the latest news on Example devices and their launch price?';
  const { session, logs } = await fixture(t, {
    meta: (payload) => {
      assert.equal(payload.model, 'muse-wonder-1.0');
      assert.ok(payload.tools.some(({ function: tool }) => tool.name === LIVE_WEB_TOOL));
      return toolTurn();
    },
    tavily: (options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, `Bearer ${fixtureKey}`);
      assert.deepEqual(JSON.parse(options.body), { query: question, search_depth: 'basic', topic: 'general', max_results: 5, include_answer: 'basic' });
      return searchReply();
    },
  });
  const { chat, userId } = await session();
  const reply = await chat(question);
  const date = tokyoTodayISO();
  assert.equal(reply.answer, `**LIVE WEB** · ${date}\n\n${source.content}`);
  assert.deepEqual(reply.web, { date, sources: [{ title: source.title, url: source.url }] });
  assert.deepEqual(logs, [{ userId, query: question, resultCount: 1, cached: false, unavailable: false }]);
  assert.doesNotMatch(JSON.stringify(reply), new RegExp(fixtureKey));
  assert.deepEqual(conversationHistory([{ role: 'assistant', content: reply.answer }]), [
    { role: 'assistant', content: 'I shared external live search results.' },
  ]);
});

test('Personal balance questions use the owner snapshot and cannot invoke Tavily', async (t) => {
  assert.equal(canSearchWeb('How much can I afford right now?'), false);
  assert.equal(canSearchWeb('What rules should I know about bank accounts?'), true);
  const { session, logs } = await fixture(t, {
    meta: ({ messages, tools }) => {
      assert.ok(!tools.some(({ function: tool }) => tool.name === LIVE_WEB_TOOL));
      assert.match(messages[0].content, /"total_balance_all_accounts_jpy":23000/);
      return messages.at(-1).content.startsWith('Show') ? toolTurn() : textTurn('Your balance is ¥23,000.');
    },
    tavily: () => assert.fail('Tavily must never receive this finance request'),
  });
  const { userId, chat } = await session();
  await AccountModel.create({ userId, name: 'Test wallet', manualBalance: 23000 });
  assert.equal((await chat('What is my account balance?')).answer, 'Your balance is ¥23,000.');
  assert.equal((await chat('Show the account balance and latest news.')).web, undefined);
  assert.deepEqual(logs, []);
});

test('Failed, missing, and empty Tavily results produce honest chat replies', async (t) => {
  const { session, logs } = await fixture(t, {
    meta: toolTurn,
    tavily: (options) => {
      if (JSON.parse(options.body).query.includes('broken')) throw new Error(fixtureKey);
      return Response.json({ answer: 'Unsourced guess', results: [] });
    },
  });
  const { chat } = await session();
  const failed = await chat('What is the latest news about the broken space probe?');
  assert.match(failed.answer, /Live search is unavailable/);
  assert.equal(failed.web, undefined);
  const missing = await chat('What is the latest news about the imaginary space probe?');
  assert.match(missing.answer, /couldn’t find a useful result/);
  assert.equal(missing.web, undefined);
  delete process.env.TAVILY_API_KEY;
  assert.match((await chat('What is the latest news about a new probe?')).answer, /Live search is unavailable/);
  assert.deepEqual(logs.map(({ resultCount, unavailable }) => [resultCount, unavailable]), [[0, true], [0, false], [0, true]]);
  assert.doesNotMatch(JSON.stringify({ failed, missing, logs }), new RegExp(fixtureKey));
});

test('Wonder selects a verified source excerpt when a search summary adds unsupported details', async (t) => {
  const useful = { title: 'Official release', url: 'https://releases.example.test', content: 'Version 2.0 is the latest release.' };
  let selections = 0;
  const { session } = await fixture(t, {
    meta: ({ messages, response_format }) => {
      if (!response_format) return toolTurn();
      selections += 1;
      assert.equal(messages.length, 2);
      assert.doesNotMatch(JSON.stringify(messages), /total_balance_all_accounts_jpy|February 28/);
      return textTurn(JSON.stringify({ source: 1, quote: useful.content }));
    },
    tavily: () => Response.json({
      answer: 'Version 2.0 was released on February 28.',
      results: [{ ...source, content: 'A previous version was available.' }, useful],
    }),
  });
  const { chat } = await session();
  const reply = await chat('What is the newest version of the sample browser?');
  assert.equal(selections, 1);
  assert.match(reply.answer, /\*\*Source excerpt\*\*\nVersion 2\.0 is the latest release\./);
  assert.doesNotMatch(reply.answer, /February/);
  assert.equal(reply.web.sources[0].url, useful.url + '/');
  assert.equal(reply.evidence, undefined);
});

test('Identical web queries share a 24-hour cache per user', async () => {
  let count = 0;
  const query = 'What is the current example price published today?';
  const now = Date.UTC(2026, 10, 25, 0);
  const userId = randomUUID();
  const options = { env: { TAVILY_API_KEY: fixtureKey }, log() {}, fetchImpl: async () => {
    count += 1;
    return searchReply();
  } };
  await Promise.all([searchLiveWeb(query, userId, { ...options, now }), searchLiveWeb(query, userId, { ...options, now })]);
  assert.equal(count, 1);
  assert.equal((await searchLiveWeb(query, userId, { ...options, now: now + 23 * 3600000 })).web.date, '2026-11-25');
  await searchLiveWeb(query, userId, { ...options, now: now + 24 * 3600000 });
  await searchLiveWeb(query, randomUUID(), { ...options, now });
  assert.equal(count, 3);
});

test('Ember fallback runs without the web tool', async (t) => {
  const { session, logs } = await fixture(t, {
    meta: ({ model, tools }) => {
      const hasWeb = tools.some(({ function: tool }) => tool.name === LIVE_WEB_TOOL);
      if (model === 'muse-wonder-1.0') {
        assert.ok(hasWeb);
        return new Response(null, { status: 503 });
      }
      assert.equal(model, 'muse-ember-1.0');
      assert.equal(hasWeb, false);
      return textTurn('Live search is unavailable right now.');
    },
  });
  const { chat } = await session();
  const reply = await chat('What is the current price of the example phone?');
  assert.equal(reply.model, 'muse-ember-1.0');
  assert.equal(reply.web, undefined);
  assert.deepEqual(logs, []);
});

test('Spending chart renders a real PNG and captions the authenticated user’s current-month engine totals', async (t) => {
  assert.equal(requestsSpendingChart('How does a spending chart work?'), false);
  const { session } = await fixture(t);
  const { userId, chat } = await session();
  const today = tokyoTodayISO();
  const month = today.slice(0, 7);
  const categories = await CategoryModel.findByUser(userId);
  for (const [name, amount, kind] of [['Food & Dining', 12500, 'expense'], ['Food & Dining', 500, 'refund'], ['Transportation', 2740, 'expense']]) {
    await TransactionModel.create({ userId, categoryId: categories.find((category) => category.name === name).id,
      kind, amount, transactionDate: today, title: name });
  }
  const engine = getCategoryBreakdown(await TransactionModel.findByUser(userId), month, categories);
  const reply = await chat('show my spending chart');
  const [top] = engine.items;
  assert.equal(reply.answer, `Spending by category for ${month} totaled ¥${engine.totalExpense.toLocaleString('ja-JP')}. ${top.name} was the largest category at ¥${top.amount.toLocaleString('ja-JP')}.`);
  const buffer = Buffer.from(reply.chart.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const png = await loadImage(buffer);
  assert.equal(png.width, reply.chart.width);
  assert.equal(png.height, reply.chart.height);
  assert.equal((await chat('graph banaideu')).answer, reply.answer);
  const other = await session();
  assert.equal((await other.chat('show my spending chart')).chart, undefined);
});
