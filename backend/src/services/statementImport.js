import { readStatementCsvRecords, StatementCsvError } from './statementCsv.js';
import { extractScannedRows, inspectStatementPdf } from './statementPdf.js';
import { inspectStatementXlsx } from './statementXlsx.js';
import { inspectStatementTable } from './statementTables.js';
import { cleanStatementSheet } from './statementCleaning.js';
import { createStatementMeta } from './statementMeta.js';

function decodeCsv(bytes) {
  for (const encoding of ['utf-8', 'shift_jis']) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      if (!text.includes('\0')) return text;
    } catch {
      // Try the other encoding used by Japanese banks.
    }
  }
  throw new StatementCsvError('The CSV must be encoded as UTF-8 or Shift JIS.');
}

async function readSheets(bytes, format) {
  if (format === 'xlsx') return inspectStatementXlsx(bytes);
  if (format === 'pdf') return inspectStatementPdf(bytes);
  const records = readStatementCsvRecords(decodeCsv(bytes));
  return [inspectStatementTable('CSV statement', records.map((cells, index) => ({ number: index + 1, cells })))];
}

export async function parseStatementImport(bytes, format, { categories, userMessage, logUsage = console.info, ...options }) {
  const meta = createStatementMeta(options);
  try {
    const source = await readSheets(bytes, format);
    if (format === 'pdf' && source.every((sheet) => !sheet.data.length)) {
      const rows = await extractScannedRows(bytes, meta, userMessage);
      const toCheck = rows.filter((row) => row.uncertain).length;
      return { rows, warnings: [], sheets: [{ name: 'Scanned PDF', found: rows.length, skipped: 0,
        reasons: [], note: null, parseMethod: 'ai', cleaned: rows.length, toCheck }] };
    }
    const rows = [];
    const warnings = [];
    const sheets = [];
    for (const sheet of source) {
      const result = await cleanStatementSheet(sheet, categories, meta, userMessage);
      rows.push(...result.rows);
      sheets.push(result.summary);
      for (const [number, reason] of result.failures) warnings.push(`${sheet.name}, row ${number}: ${reason}.`);
    }
    return { rows, warnings, sheets };
  } finally {
    logUsage('[LA-BO import tokens]', { format, ...meta.usage });
  }
}

export function emptyStatementMessage(sheets) {
  const reason = sheets.filter((sheet) => sheet.skipped).map((sheet) => {
    const details = sheet.reasons.map(({ reason, count }) => `${count} × ${reason}`).join(', ');
    return `${sheet.name}: ${sheet.skipped} skipped (${details}).`;
  }).join(' ');
  const unavailable = sheets.some((sheet) => sheet.parseMethod === 'fallback') ? ' AI cleaning was unavailable.' : '';
  return ('I couldn’t read any transactions. Check the date, description, and amount columns.' + unavailable + ' ' + reason).trim();
}
