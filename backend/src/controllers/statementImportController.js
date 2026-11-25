import { CategoryModel } from '../models/categoryModel.js';
import { AccountModel } from '../models/accountModel.js';
import { TransactionModel } from '../models/transactionModel.js';
import { MemoryModel } from '../models/memoryModel.js';
import { emptyStatementMessage, parseStatementImport } from '../services/statementImport.js';
import { buildStatementReview } from '../services/statementReview.js';
import { matchStatementAccounts } from '../services/statementAccounts.js';

function readStatementMessage(req) {
  try {
    return decodeURIComponent(req.get('X-Statement-Message') ?? '').slice(0, 500);
  } catch {
    return '';
  }
}

export async function previewStatement(req, res, next) {
  const format = req.get('X-Statement-Format');
  const bytes = req.body;
  if (!['csv', 'pdf', 'xlsx'].includes(format) || !Buffer.isBuffer(bytes) || bytes.length === 0) {
    return res.status(400).json({ error: 'Attach a CSV, PDF, or XLSX statement. Older XLS files are unsupported.', status: 400 });
  }

  try {
    const categories = await CategoryModel.findByUser(req.user.id, { seedDefaults: false });
    const { rows, warnings, sheets } = await parseStatementImport(bytes, format, {
      categories, userMessage: readStatementMessage(req),
    });
    if (!rows.length) {
      return res.status(422).json({ error: emptyStatementMessage(sheets), status: 422 });
    }
    if (rows.length > 1000) {
      return res.status(422).json({ error: 'Split this statement into files of at most 1,000 transactions.', status: 422 });
    }
    const [transactions, memory, accounts] = await Promise.all([
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
