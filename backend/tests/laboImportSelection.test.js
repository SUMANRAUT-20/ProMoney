import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStatementAccount, saveSelectedStatementRows, statementReviewNet } from '../../frontend/src/features/labo/saveSelectedStatementRows.js';
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

test('A selected invalid date blocks every save, and apply-to-all confirms replacing row choices', async () => {
  const [train, , salary] = reviewedRows;
  const rows = [{ ...train, account_id: '2', amount: '500' }, { ...salary, transaction_date: '2026-02-30' }];
  const invalid = await saveSelectedStatementRows(rows, () => assert.fail('No rows should be saved'), '1');
  assert.deepEqual(invalid.savedIds, []);
  assert.match(invalid.error.message, /Row 3 \(Salary\).*valid calendar date/);
  assert.equal(statementReviewNet(rows), 14500);
  assert.equal(applyStatementAccount(rows, '1', () => false), null);
  const applied = applyStatementAccount(rows, '1', () => true);
  assert.ok(applied.every((row) => !row.account_id));
  const unchanged = applyStatementAccount(rows, '2', () => assert.fail('No override would change'));
  assert.ok(unchanged.every((row) => !row.account_id));
});
