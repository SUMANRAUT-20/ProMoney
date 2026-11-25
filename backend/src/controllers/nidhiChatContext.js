import { BudgetModel } from '../models/budgetModel.js';
import { CategoryModel } from '../models/categoryModel.js';
import { MemoryModel } from '../models/memoryModel.js';
import { askLabo } from '../services/laboChat.js';
import { conversationHistory } from '../services/laboConversation.js';
import { buildFinanceSnapshot } from '../services/laboSnapshot.js';
import { aboutThisUser } from '../services/nidhiMemory.js';
import { actionFromTool, importGuidance, nidhiTools } from '../services/nidhiTools.js';
import { prepareChatExport, prepareChatReport } from './laboInsights.js';
import { loadLaboPlan } from './laboSimulators.js';

function availableLabels(finance) {
  return {
    accounts: finance.accounts.slice(0, 18).map(({ name }) => name.slice(0, 100)),
    categories: finance.categories.slice(0, 32).map(({ name, kind }) => [name.slice(0, 60), kind]),
  };
}

function readTool(name, args, userId) {
  if (name === 'start_import_guidance') return { answer: importGuidance(args?.legacy_xls === true) };
  const request = typeof args?.request === 'string' && args.request.trim();
  if (!request || request.length > 400) return null;
  if (name === 'get_report') return prepareChatReport('Report ' + request, userId);
  if (name === 'make_export' && ['pdf', 'xlsx', 'csv'].includes(args.format)) {
    return prepareChatExport(request, args.format, userId);
  }
  return null;
}

export async function chatForUser({ userId, question, history }) {
  const [plan, budgets, categories, memory] = await Promise.all([
    loadLaboPlan(userId), BudgetModel.findByUser(userId),
    CategoryModel.findByUser(userId, { seedDefaults: false }), MemoryModel.findByUser(userId),
  ]);
  const finance = { ...plan, budgets, categories };
  const snapshot = buildFinanceSnapshot(finance);
  const userText = [...conversationHistory(history).filter((turn) => turn.role === 'user').map((turn) => turn.content), question].join('\n');
  return askLabo({
    question, snapshot, history, aboutUser: aboutThisUser(memory), appContext: availableLabels(finance), tools: nidhiTools,
    resolveTool: (name, args) => name.startsWith('propose_')
      ? actionFromTool(name, args, { finance, userText, today: snapshot.today })
      : readTool(name, args, userId),
  });
}
