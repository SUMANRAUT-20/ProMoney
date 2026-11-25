import assert from 'node:assert/strict';
import test from 'node:test';
import { sendChatDraft, stageChatAttachment } from '../../frontend/src/features/labo/composerDraft.js';

test('Choosing or replacing a chat attachment leaves the file staged and makes no request', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('Staging made a network request'));
  const statement = new File(['csv bytes'], 'november.csv', { type: 'text/csv' });
  const receipt = new File(['image bytes'], 'receipt.png', { type: 'image/png' });
  assert.deepEqual(stageChatAttachment([statement]), { file: statement, format: 'csv' });
  assert.deepEqual(stageChatAttachment([receipt]), { file: receipt, format: 'photo' });
  assert.equal(stageChatAttachment([]), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test('Send delivers the staged file and the draft text to one flow, including file-only sends', async () => {
  const calls = [];
  const handlers = {
    ask: (text) => calls.push(['chat', text]),
    scanPhoto: (...data) => calls.push(['receipt', ...data]),
    importStatement: (...data) => calls.push(['statement', ...data]),
  };
  const statement = new File(['xlsx bytes'], 'november.xlsx');
  const receipt = new File(['image bytes'], 'receipt.png');
  await sendChatDraft('今月の明細を確認', stageChatAttachment([statement]), handlers);
  await sendChatDraft('Check this receipt', stageChatAttachment([receipt]), handlers);
  await sendChatDraft('', stageChatAttachment([statement]), handlers);
  await sendChatDraft('What can I safely spend?', null, handlers);
  assert.deepEqual(calls, [
    ['statement', statement, 'xlsx', '今月の明細を確認'],
    ['receipt', receipt, 'Check this receipt'],
    ['statement', statement, 'xlsx', ''],
    ['chat', 'What can I safely spend?'],
  ]);
});
