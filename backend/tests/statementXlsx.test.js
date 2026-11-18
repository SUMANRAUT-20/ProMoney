import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import ExcelJS from 'exceljs';
import { getDbPool } from '../src/db.js';
import { previewStatement } from '../src/controllers/statementImportController.js';
import { transactionsController } from '../src/controllers/transactionsController.js';
import { UserModel } from '../src/models/userModel.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import { parseStatementXlsx } from '../src/services/statementXlsx.js';
import { parseStatementCsv } from '../src/services/statementCsv.js';
import { saveSelectedStatementRows } from '../../frontend/src/features/labo/saveSelectedStatementRows.js';
import { dummyTemplateBytes } from './fixtures/dummyTemplate.js';
import { buildStatementReview } from '../src/services/statementReview.js';

after(() => getDbPool().end());

function mockRes() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const next = (error) => { if (error) throw error; };

async function workbookBytes(rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Statement').addRows(rows);
  workbook.addWorksheet('Ignored').addRows([['Unrecognized second sheet']]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('XLSX English headers use the CSV normalization after detecting the first sheet header', async () => {
  const bytes = await workbookBytes([
    ['Bank statement'], [],
    ['Date', 'Description', 'Amount (JPY)', 'Currency'],
    [new Date('2026-11-10T00:00:00Z'), 'Konbini purchase', -850, 'JPY'],
    ['2026-11-11', { richText: [{ text: 'Nov ' }, { text: 'Salary' }] }, 75000, 'JPY'],
  ]);
  assert.deepEqual(await parseStatementXlsx(bytes), parseStatementCsv(
    'Date,Description,Amount (JPY),Currency\n2026-11-10,Konbini purchase,-850,JPY\n2026-11-11,Nov Salary,75000,JPY',
  ));
});

test('XLSX Japanese money-in and money-out headers produce the same rows as CSV', async () => {
  const bytes = await workbookBytes([
    ['取引日', 'お取引内容', '入金額（円）', '出金額（円）'],
    ['2026年11月10日', '給料', 75000],
    ['2026/11/11', 'スーパー', null, 850],
  ]);
  assert.deepEqual(await parseStatementXlsx(bytes), parseStatementCsv(
    '取引日,お取引内容,入金額（円）,出金額（円）\n2026年11月10日,給料,75000,\n2026/11/11,スーパー,,850',
  ));
});

test('XLSX rejects old XLS, malformed workbooks and unrecognized first-sheet columns', async () => {
  for (const bytes of [
    Buffer.from('d0cf11e0a1b11ae1', 'hex'),
    Buffer.from('PK\x03\x04broken'),
    await workbookBytes([['Date', 'Description', 'Balance'], ['2026-11-10', 'Shop', 1000]]),
  ]) {
    await assert.rejects(parseStatementXlsx(bytes), { code: 'STATEMENT_UNREADABLE' });
  }
});

test('team dummy template reads transaction tabs past instruction sheets and excludes invalid dates with a warning', async () => {
  const warnings = [];
  const parsed = await parseStatementXlsx(await dummyTemplateBytes(), { onWarning: (message) => warnings.push(message) });
  const categories = [{ id: 1, name: 'Housing', kind: 'expense' }, { id: 2, name: 'Salary', kind: 'income' }];
  const review = buildStatementReview(parsed, categories, [
    { transaction_date: '2026-01-01', amount: 40000, title: 'Monthly rent' },
  ]);
  assert.deepEqual(review.map(({ transaction_date, note, amount, kind, possibleDuplicate, selected }) => [
    transaction_date, note, amount, kind, possibleDuplicate, selected,
  ]), [
    ['2026-01-01', 'Monthly rent', 40000, 'expense', true, false],
    ['2026-02-25', 'Salary', 75000, 'income', false, true],
  ]);
  assert.deepEqual(warnings, ['02 Feb, row 16 was excluded: Invalid calendar date.']);
});

test('XLSX review marks duplicates unticked and saves only selected rows through transaction creation', async () => {
  const user = await UserModel.create({
    displayName: 'Excel Import Test', email: `xlsx+${randomUUID()}@example.com`, passwordHash: null,
  });
  const existing = await TransactionModel.create({
    userId: user.id, kind: 'expense', title: 'Konbini purchase', amount: 850, transactionDate: '2026-11-10',
  });
  const bytes = await workbookBytes([
    ['Date', 'Description', 'Amount'],
    ['2026-11-10', 'Konbini purchase', -850],
    ['2026-11-11', 'Salary', 75000],
    ['2026-11-12', 'Train ticket', -250],
  ]);
  const preview = mockRes();
  await previewStatement({ user, get: () => 'xlsx', body: bytes }, preview, next);
  assert.equal(preview.statusCode, 200);
  const { data: { rows } } = preview.body;
  assert.deepEqual(rows.map(({ possibleDuplicate, selected }) => [possibleDuplicate, selected]), [
    [true, false], [false, true], [false, true],
  ]);
  assert.deepEqual((await TransactionModel.findByUser(user.id)).map(({ id }) => id), [existing.id]);
  rows[2].selected = false;
  const result = await saveSelectedStatementRows(rows, async (body) => {
    const response = mockRes();
    await transactionsController.create({ user, body }, response, next);
    assert.equal(response.statusCode, 201);
    return response.body.data;
  }, null);
  assert.equal(result.error, null);
  assert.equal(result.savedIds.length, 1);
  assert.deepEqual((await TransactionModel.findByUser(user.id)).map(({ note }) => note), ['Salary', 'Konbini purchase']);
  const rejected = mockRes();
  await previewStatement({ user, get: () => 'xls', body: bytes }, rejected, next);
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.body.error, /Older XLS files are unsupported/);
});
