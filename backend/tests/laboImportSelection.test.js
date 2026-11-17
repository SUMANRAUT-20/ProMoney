import assert from 'node:assert/strict';
import test from 'node:test';
import { saveSelectedStatementRows } from '../../frontend/src/features/labo/saveSelectedStatementRows.js';
import { getStatementNet } from '../../frontend/src/utils/financeMath.js';

const reviewedRows = [
  { id: 'row1', selected: true, transaction_date: '2026-11-01', note: 'Train', kind: 'expense', amount: 320, category_id: 'edited' },
  { id: 'row2', selected: false, possibleDuplicate: true, transaction_date: '2026-11-02', note: 'Coffee', kind: 'expense', amount: 480, category_id: 'food' },
  { id: 'row3', selected: true, transaction_date: '2026-11-03', note: 'Salary', kind: 'income', amount: 15000, category_id: 'salary' },
];

test('statement Add selected retries only rows that were not confirmed saved', async () => {
  const notes = [];
  const failure = new Error('Temporary transaction error');
  const first = await saveSelectedStatementRows(reviewedRows, async ({ note }) => {
    notes.push(note);
    if (note === 'Salary') throw failure;
    return { id: 21 };
  }, null);

  assert.deepEqual(first.savedIds, [21]);
  assert.equal(first.error, failure);
  assert.deepEqual(first.remainingRows, reviewedRows.slice(1));
  assert.equal(getStatementNet(first.remainingRows.filter((row) => row.selected)), 15000);

  const retry = await saveSelectedStatementRows(first.remainingRows, async ({ note }) => {
    notes.push(note);
    return { id: 22 };
  }, null);
  assert.deepEqual(notes, ['Train', 'Salary', 'Salary']);
  assert.deepEqual(retry, { savedIds: [22], remainingRows: [], error: null });
});
