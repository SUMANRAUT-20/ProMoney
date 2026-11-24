import { BudgetModel } from '../models/budgetModel.js';
import { CategoryModel } from '../models/categoryModel.js';
import { TransactionModel } from '../models/transactionModel.js';
import { buildHomeSummary } from '../services/financeMath.js';
import { buildFinanceReport, reportRequest } from '../services/financeReport.js';
import { reportCsv, reportPdf, reportXlsx, signReport, verifyReport } from '../services/reportExport.js';
import { chatExportFormat, parseChatExport } from '../services/chatExportRequest.js';
import { buildChatExportReport, loadChatExportData } from '../services/chatExportReport.js';
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

async function prepareChatExport(question, format, userId) {
  const data = await loadChatExportData(userId);
  const exportQuery = parseChatExport(question, { format, categories: data.categories, accounts: data.accounts });
  if (exportQuery.error) return { answer: exportQuery.error };
  const result = buildChatExportReport(exportQuery, data);
  if (!result.hasData) {
    return { answer: result.nearest
      ? `No matching data for ${result.period}. Ask for the same report for ${result.nearest}.`
      : `No matching data for ${result.period}. Add records on the relevant page, then try again.` };
  }
  const report = { title: result.title, period: result.period, exportQuery };
  return { answer: 'Your report is ready to download.', report, signature: signReport(report, userId), downloadFormat: format };
}

export async function getLaboInsight(question, userId) {
  const format = chatExportFormat(question);
  if (format) return prepareChatExport(question, format, userId);
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
  const answer = report.hasData
    ? 'Here’s your report from the ProMoney engine.'
    : 'There’s no activity to report for that scope. You can add records on the Transactions page.';
  return { answer, report, signature: signReport(report, userId) };
}

export async function exportLaboReport(req, res, next) {
  const { format, report, signature } = req.body ?? {};
  try {
    const validFormat = report?.exportQuery ? format === report.exportQuery.format : ['csv', 'pdf'].includes(format);
    if (!validFormat || !Object.hasOwn(exportFormats, format) || !verifyReport(report, signature, req.user.id)) {
      return res.status(400).json({ error: 'Open a new report card to download this report.', status: 400 });
    }
    const data = report.exportQuery
      ? buildChatExportReport(report.exportQuery, await loadChatExportData(req.user.id)) : report;
    if (report.exportQuery && !data.hasData) {
      return res.status(404).json({ error: 'There is no matching data in this period now. Ask for a new report.', status: 404 });
    }
    const { encode, type } = exportFormats[format];
    const content = await encode(data);
    return res.set('Cache-Control', 'no-store').attachment(`promoney-report.${format}`)
      .type(type).send(content);
  } catch (error) {
    return next(error);
  }
}

const exportFormats = {
  csv: { encode: reportCsv, type: 'text/csv' },
  pdf: { encode: reportPdf, type: 'application/pdf' },
  xlsx: { encode: reportXlsx, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
};
