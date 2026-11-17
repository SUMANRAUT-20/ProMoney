import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStatementCsv, StatementCsvError } from '../src/services/statementCsv.js';
import { buildStatementReview } from '../src/services/statementReview.js';

const csv = readFileSync(new URL('fixtures/bank-statement.csv', import.meta.url), 'utf8');
const categories = [
  { id: 1, name: 'Salary', kind: 'income' },
  { id: 2, name: 'Food & Dining', kind: 'expense' },
  { id: 3, name: 'Groceries', kind: 'expense' },
];

test('bank statement CSV yields review rows with exact amounts and category suggestions', () => {
  const rows = buildStatementReview(parseStatementCsv('\uFEFF' + csv.replaceAll('\n', '\r\n')), categories, []);
  assert.deepEqual(rows.map(({ transaction_date, note, amount, kind, category_name }) => [
    transaction_date, note, amount, kind, category_name,
  ]), [
    ['2026-11-05', 'City Supermarket, Shibuya', 2540, 'expense', 'Groceries'],
    ['2026-11-06', 'November Payroll', 150000, 'income', 'Salary'],
    ['2026-11-07', 'Coffee at "The Loft"', 520, 'expense', 'Food & Dining'],
  ]);
  assert.ok(rows.every(({ possibleDuplicate, selected }) => !possibleDuplicate && selected));
});

test('a duplicate candidate needs matching date, amount, and similar title and starts unticked', () => {
  const rows = parseStatementCsv(csv);
  const existing = [
    { transaction_date: '2026-11-05', amount: '2540', title: 'ＣＩＴＹ SUPERMARKET' },
    { transaction_date: '2026-11-06', amount: 150000, title: 'Tax Refund' },
    { transaction_date: '2026-11-06', amount: 150001, title: 'November Payroll' },
    { transaction_date: '2026-11-08', amount: 520, title: 'Coffee at "The Loft"' },
  ];
  const review = buildStatementReview(rows, categories, existing);
  assert.deepEqual(review.map(({ possibleDuplicate, selected }) => [possibleDuplicate, selected]), [
    [true, false], [false, true], [false, true],
  ]);
});

test('Japanese split columns and an unambiguous day-first statement parse without guessing', () => {
  assert.deepEqual(
    parseStatementCsv('日付,内容,入金額,出金額,通貨\n2026年11月5日,給料,"￥25,000",,JPY\n2026/11/6,スーパー,0,１２００円,円\n'),
    [
      { transaction_date: '2026-11-05', note: '給料', kind: 'income', amount: 25000 },
      { transaction_date: '2026-11-06', note: 'スーパー', kind: 'expense', amount: 1200 },
    ],
  );
  assert.deepEqual(
    parseStatementCsv('Date;Memo;Amount\n17/11/2026;Coffee;-300\n06/11/2026;Payroll;3000')
      .map((row) => row.transaction_date),
    ['2026-11-17', '2026-11-06'],
  );
});

test('unknown or ambiguous CSV shapes are refused with a column diagnostic', () => {
  for (const input of [
    'Column A,Column B,Column C\n2026-11-05,Grocery,200',
    'Date,Description,Amount,Amount (JPY)\n2026-11-05,Grocery,200,200',
    'Date,Description,Balance\n2026-11-05,Grocery,200',
  ]) {
    assert.throws(() => parseStatementCsv(input), {
      code: 'STATEMENT_UNREADABLE',
      message: /could not recognize the statement columns/i,
    });
  }
});

test('known CSV shapes with uncertain dates or invalid amounts produce no partial review', () => {
  for (const bad of [
    '2026-11-05,Lunch,5.25,JPY',
    '2026-11-05,Lunch,100,USD',
    '01/02/2026,Lunch,100,JPY',
    '2026-02-30,Lunch,100,JPY',
    '2026-11-05,Lunch,"1,2",JPY',
    '2026-11-05,Lunch,1000000000000,JPY',
  ]) {
    assert.throws(
      () => parseStatementCsv('Date,Description,Amount,Currency\n2026-11-04,Valid,100,JPY\n' + bad),
      (error) => error instanceof StatementCsvError && /data row 2/.test(error.message),
    );
  }
});
