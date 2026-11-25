import { CategoryModel } from '../models/categoryModel.js';
import { AccountModel } from '../models/accountModel.js';
import { TransactionModel } from '../models/transactionModel.js';
import { MemoryModel } from '../models/memoryModel.js';
import { parseStatementCsv } from '../services/statementCsv.js';
import { parseStatementPdf } from '../services/statementPdf.js';
import { parseStatementXlsx } from '../services/statementXlsx.js';
import { buildStatementReview } from '../services/statementReview.js';
import { matchStatementAccounts } from '../services/statementAccounts.js';

function decodeCsv(bytes) {
  for (const encoding of ['utf-8', 'shift_jis']) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      if (!text.includes('\0')) return text;
    } catch {
      // Try the other encoding used by Japanese banks.
    }
  }
  return null;
}

export async function previewStatement(req, res, next) {
  const format = req.get('X-Statement-Format');
  const bytes = req.body;
  if (!['csv', 'pdf', 'xlsx'].includes(format) || !Buffer.isBuffer(bytes) || bytes.length === 0) {
    return res.status(400).json({ error: 'Attach a CSV, PDF, or XLSX statement. Older XLS files are unsupported.', status: 400 });
  }

  try {
    const warnings = [];
    const sheets = [];
    const text = format === 'csv' ? decodeCsv(bytes) : null;
    if (format === 'csv' && text === null) {
      return res.status(422).json({ error: 'The CSV must be encoded as UTF-8 or Shift JIS.', status: 422 });
    }
    const rows = format === 'csv' ? parseStatementCsv(text)
      : format === 'xlsx' ? await parseStatementXlsx(bytes, {
        onWarning: (message) => warnings.push(message),
        onSheet: (sheet) => sheets.push(sheet),
      })
        : await parseStatementPdf(bytes);
    if (!rows.length) {
      return res.status(422).json({ error: 'I couldn’t read any transactions from this file. Check its date, description, and amount columns.', status: 422 });
    }
    if (rows.length > 1000) {
      return res.status(422).json({ error: 'Split this statement into files of at most 1,000 transactions.', status: 422 });
    }
    const [categories, transactions, memory, accounts] = await Promise.all([
      CategoryModel.findByUser(req.user.id, { seedDefaults: false }),
      TransactionModel.findByUser(req.user.id),
      MemoryModel.findByUser(req.user.id),
      rows.some((row) => Object.hasOwn(row, 'accountLabel')) ? AccountModel.findByUser(req.user.id) : [],
    ]);
    console.info('[LA-BO import]', { format, rowsFound: rows.length, status: 200 });
    const review = buildStatementReview(rows, categories, transactions, memory.merchantMap);
    return res.json({ status: 'ok', data: {
      ...matchStatementAccounts(review, accounts, memory.accountMap), warnings, sheets,
    } });
  } catch (err) {
    if (err.code === 'STATEMENT_UNREADABLE') {
      return res.status(422).json({ error: err.message, status: 422 });
    }
    return next(err);
  }
}
