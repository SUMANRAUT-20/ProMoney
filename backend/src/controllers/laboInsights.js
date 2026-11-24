import { BudgetModel } from '../models/budgetModel.js';
import { CategoryModel } from '../models/categoryModel.js';
import { TransactionModel } from '../models/transactionModel.js';
import { buildHomeSummary } from '../services/financeMath.js';
import { buildFinanceReport, reportRequest } from '../services/financeReport.js';
import { reportCsv, reportPdf, signReport, verifyReport } from '../services/reportExport.js';
import { getSimulatorInsight, loadLaboPlan } from './laboSimulators.js';

async function currentAlerts(userId, japanese) {
  const [data, budgets] = await Promise.all([
    loadLaboPlan(userId), BudgetModel.findByUser(userId),
  ]);
  const home = buildHomeSummary({ ...data, budgets });
  const warnings = home.warnings.map(({ title }) => title);
  const answer = japanese
    ? (warnings.length ? '最新のアラートをお伝えします。' : '現在、アラートはありません。')
    : (warnings.length ? 'Here are your current alerts.' : 'You have no current alerts.');
  return { answer, warnings };
}

export async function getLaboInsight(question, userId) {
  if (/^(?:any |hear (?:my )?|show (?:me )?(?:my )?|read (?:out )?(?:my )?|do i have (?:any )?|what are (?:my |the )?|are there (?:any )?)?(?:current )?(?:alerts|warnings)(?: today)?[.!?\s]*$/i.test(question)
    || /^(?:アラート|警告)(?:を聞く|はある|はありますか)?[？?。\s]*$/.test(question)) {
    return currentAlerts(userId, /[\u3040-\u30ff\u4e00-\u9faf]/.test(question));
  }
  const simulation = await getSimulatorInsight(question, userId);
  if (simulation) return simulation;
  const request = reportRequest(question);
  if (!request) return null;
  if (!request.months) {
    return { answer: 'Try a category report for one month, or an income and expenses report for up to two months.' };
  }
  const [transactions, categories] = await Promise.all([
    TransactionModel.findByUser(userId),
    request.kind === 'categories' ? CategoryModel.findByUser(userId, { seedDefaults: false }) : [],
  ]);
  const report = buildFinanceReport({ ...request, transactions, categories });
  const answer = report.hasData && /\bpdf\b/i.test(question)
    ? 'Here’s your report. Choose Download PDF on the card.'
    : report.hasData
    ? 'Here’s your report from the ProMoney engine.'
    : 'There’s no activity to report for that scope. You can add records on the Transactions page.';
  return { answer, report, signature: signReport(report, userId) };
}

export async function exportLaboReport(req, res, next) {
  const { format, report, signature } = req.body ?? {};
  try {
    if (!['csv', 'pdf'].includes(format) || !verifyReport(report, signature, req.user.id)) {
      return res.status(400).json({ error: 'Open a new report card to download this report.', status: 400 });
    }
    const content = format === 'csv' ? reportCsv(report) : await reportPdf(report);
    return res.set('Cache-Control', 'no-store').attachment(`promoney-report.${format}`)
      .type(format === 'csv' ? 'text/csv' : 'application/pdf').send(content);
  } catch (error) {
    return next(error);
  }
}
