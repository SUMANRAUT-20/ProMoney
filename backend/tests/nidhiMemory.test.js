import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { signToken } from '../src/middleware/authMiddleware.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { MemoryModel } from '../src/models/memoryModel.js';
import { UserModel } from '../src/models/userModel.js';
import apiRouter from '../src/routes/index.js';
import { buildLaboMessages, buildParseMessages } from '../src/services/laboChat.js';
import { proposeMemoryUpdate } from '../src/services/laboMemory.js';
import { aboutThisUser, cleanMemory, memoryCategory, memoryEntries, mergeMemory } from '../src/services/nidhiMemory.js';
import { statementMemoryCorrections } from '../../frontend/src/features/labo/saveSelectedStatementRows.js';

async function fixture(t) {
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
      displayName: 'Memory test', email: `memory-${randomUUID()}@example.test`, passwordHash: null,
    });
    const token = signToken(user);
    const request = async (path, method = 'GET', body, headers = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
      return { ...(await response.json()), status: response.status };
    };
    return { id: user.id, request };
  };
}

test('Memory sanitizes secrets, deduplicates fact keys and renders approved preferences as data', () => {
  const initial = cleanMemory({
    style: { languageMix: 'Roman Nepali and English' },
    facts: [{ key: 'Project', value: 'Kanji' }, { key: 'password_value', value: 'a-test-secret' }],
    wordMap: { Khana: 'Food & Dining' },
    merchantMap: { pin_code: 'should never appear' },
    patterns: { regularSpends: { 'card number': '４１１１-１１１１-１１１１-１１１１' } },
    summary: 'pin_code=1234',
  });
  const merged = mergeMemory(initial, {
    facts: [{ key: 'project', value: 'Japanese class' }, { key: 'Project', value: 'Japanese class' }],
    wordMap: { khana: 'Shopping' },
  });
  assert.deepEqual(merged.facts, [{ key: 'project', value: 'Japanese class' }]);
  assert.deepEqual(merged.wordMap, { khana: 'Shopping' });
  assert.deepEqual(merged.merchantMap, {});
  assert.equal(merged.summary, undefined);
  const messages = buildLaboMessages({ question: 'Hello', snapshot: {}, aboutUser: aboutThisUser(merged) });
  assert.match(messages[0].content, /ABOUT THIS USER[\s\S]*Roman Nepali and English/);
  assert.doesNotMatch(messages[0].content, /a-test-secret|4111|pin_code/);
  assert.equal(memoryCategory('khana 800', 'expense', [{ id: 5, kind: 'expense', name: 'Shopping' }], merged.wordMap).id, 5);
  assert.match(buildParseMessages({ text: 'khana 800', categories: [], today: '2026-11-24', wordMap: merged.wordMap })[1].content,
    /approved word\/category pairs.*khana.*Shopping/);
});

test('The extraction model proposes changes without persisting them or sending credential-like text', async () => {
  const current = cleanMemory();
  let queries = 0;
  const options = {
    env: { AI_PROVIDER: 'meta', META_API_KEY: 'test-meta' },
    fetchImpl: async () => {
      queries += 1;
      return Response.json({ choices: [{ message: { content: '{"style":{"messageLength":"Short"},"patterns":{"payday":25}}' } }] });
    },
  };
  const proposal = await proposeMemoryUpdate({ question: 'Payday is the 25th. I like short replies.', answer: 'Got it.', current }, options);
  assert.equal(proposal.patch.patterns.payday, 25);
  assert.equal(proposal.entries.length, 2);
  assert.deepEqual(memoryEntries(current), []);
  assert.equal(await proposeMemoryUpdate({ question: 'My PIN is 1234', answer: 'Okay', current }, options), null);
  assert.equal(queries, 1);
});

test('Approved memory persists privately, learns the corrected merchant, and supports forget and clear', async (t) => {
  const session = await fixture(t);
  const owner = await session();
  const other = await session();
  const source = 'Date,Description,Amount\n2026-11-12,Bluebird Cafe,-1200';
  const preview = ({ request }) => request('labo/import', 'POST', source, {
    'Content-Type': 'application/octet-stream', 'X-Statement-Format': 'csv',
  });
  const [{ data: categories }, original] = await Promise.all([owner.request('categories'), preview(owner)]);
  const row = original.data.rows[0];
  const entertainment = categories.find((category) => category.name === 'Entertainment');
  assert.equal(row.category_name, 'Food & Dining');
  const merchantMap = statementMemoryCorrections([{ ...row, suggestedCategoryId: row.category_id, category_id: entertainment.id }], categories);
  const initial = { merchantMap, style: { messageLength: 'Short' }, patterns: { payday: 25 } };
  assert.equal((await owner.request('settings/memory', 'PATCH', { patch: initial })).status, 200);
  assert.equal((await MemoryModel.findByUser(owner.id)).patterns.payday, 25);
  assert.deepEqual((await other.request('settings/memory')).data.entries, []);
  assert.equal((await other.request('settings/memory/merchantMap/bluebird%20cafe', 'DELETE')).status, 404);
  const remembered = (await preview(owner)).data.rows[0];
  assert.equal(remembered.category_name, 'Entertainment');
  assert.equal(remembered.rememberedCategory, true);
  assert.equal((await preview(other)).data.rows[0].category_name, 'Food & Dining');

  await owner.request('settings/memory', 'PATCH', { patch: { patterns: { payday: 28 }, merchantMap: { 'Bluebird Cafe': 'Shopping' } } });
  const changed = await MemoryModel.findByUser(owner.id);
  assert.equal(changed.patterns.payday, 28);
  assert.deepEqual(changed.merchantMap, { 'bluebird cafe': 'Shopping' });
  await owner.request('settings/memory/merchantMap/bluebird%20cafe', 'DELETE');
  assert.equal((await preview(owner)).data.rows[0].category_name, 'Food & Dining');
  await owner.request('settings/memory', 'DELETE');
  assert.deepEqual((await owner.request('settings/memory')).data.entries, []);
  assert.equal((await owner.request('settings')).status, 200);
});
