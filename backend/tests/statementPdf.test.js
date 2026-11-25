import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStatementPdf } from '../src/services/statementPdf.js';

function pdfFixture(stream) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(String(Buffer.byteLength(pdf)).padStart(10, '0'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${offset} 00000 n \n`).join('')}`;
  return Buffer.from(`${pdf}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF\n`);
}

const textCell = (x, y, text) => `BT /F1 11 Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`;
const scannedStatement = pdfFixture('q 100 0 0 100 100 100 cm BI /W 1 /H 1 /CS /G /BPC 8 ID\nx\nEI Q');
const metaEnv = { AI_PROVIDER: 'meta', META_MODEL: 'muse-ember-1.0', META_API_KEY: 'fixture' };

test('PDF import parses aligned text-layer transactions without sending the document to Meta', async () => {
  const statement = pdfFixture([
    textCell(30, 740, 'November statement'),
    textCell(30, 720, 'Date'), textCell(154, 720, 'Description'),
    textCell(330, 720, 'Debit'), textCell(430, 720, 'Credit'), textCell(520, 720, 'Balance'),
    textCell(30, 700, '2026-11-08'), textCell(154, 700, 'Train ticket'),
    textCell(330, 700, '250'), textCell(520, 700, '2000'),
    textCell(30, 680, '2026-11-09'), textCell(154, 680, 'Salary'),
    textCell(430, 680, '5000'), textCell(520, 680, '7000'),
  ].join('\n'));
  let calls = 0;
  const rows = await parseStatementPdf(statement, { env: metaEnv, fetchImpl: async () => { calls++; } });
  assert.equal(calls, 0);
  assert.deepEqual(rows, [
    { transaction_date: '2026-11-08', note: 'Train ticket', kind: 'expense', amount: 250 },
    { transaction_date: '2026-11-09', note: 'Salary', kind: 'income', amount: 5000 },
  ]);
});

test('scanned PDF uses an inline PDF file content block and preserves uncertain rows and file labels', async () => {
  let request;
  const row = {
    transaction_date: '2026-11-08', note: 'Bus fare', kind: 'expense', amount: 320, uncertain: true,
    accountLabel: 'Demo Cash', paymentMethod: 'Cash', categoryLabel: 'Transportation',
  };
  const rows = await parseStatementPdf(scannedStatement, {
    env: metaEnv,
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ rows: [row] }) } }] }) };
    },
  });
  assert.equal(request.model, 'muse-ember-1.0');
  assert.deepEqual(request.messages[1].content[1], {
    type: 'file',
    file: { filename: 'statement.pdf', file_data: `data:application/pdf;base64,${scannedStatement.toString('base64')}` },
  });
  assert.deepEqual(rows, [row]);
});

test('unreadable scanned PDF fails honestly without generating review rows', async () => {
  await assert.rejects(parseStatementPdf(scannedStatement, {
    env: metaEnv,
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"rows":[]}' } }] }) }),
  }), { code: 'STATEMENT_UNREADABLE', message: /could not read transactions/ });
});

test('PDF with an unusable transaction text layer attempts document extraction', async () => {
  const statement = pdfFixture([
    textCell(30, 720, 'Date'), textCell(154, 720, 'Description'), textCell(330, 720, 'Amount'),
    textCell(30, 700, '2026-11-08'), textCell(154, 700, 'Train ticket'), textCell(330, 700, 'Unreadable'),
  ].join('\n'));
  let calls = 0;
  await assert.rejects(parseStatementPdf(statement, {
    env: metaEnv,
    fetchImpl: async () => {
      calls++;
      return { ok: false, status: 502 };
    },
  }), { code: 'STATEMENT_UNREADABLE', message: /could not read transactions/ });
  assert.equal(calls, 1);
});
