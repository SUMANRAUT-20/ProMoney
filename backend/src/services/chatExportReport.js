import { AccountModel } from '../models/accountModel.js';
import { BudgetModel } from '../models/budgetModel.js';
import { CategoryModel } from '../models/categoryModel.js';
import { GoalModel } from '../models/goalModel.js';
import { TransactionModel } from '../models/transactionModel.js';
import { calculateGoalProgress, getBudgetStatus } from './financeMath.js';
import { buildFinanceReport } from './financeReport.js';

export async function loadChatExportData(userId) {
  const [accounts, categories, transactions, budgets, goals] = await Promise.all([
    AccountModel.findByUser(userId), CategoryModel.findByUser(userId, { seedDefaults: false }),
    TransactionModel.findByUser(userId), BudgetModel.findByUser(userId), GoalModel.findByUser(userId),
  ]);
  return { accounts, categories, transactions, budgets, goals };
}

const monthOf = (date) => String(date).slice(0, 7);
const matches = (ids, value) => !ids.length || ids.includes(value);

function transactionTable(transactions, accounts) {
  const names = new Map(accounts.map(({ id, name }) => [id, name]));
  return {
    title: 'Transactions',
    columns: ['Date', 'Note', 'Category', 'Account', 'Type', 'Amount (JPY)'],
    rows: transactions.map((tx) => [
      tx.transaction_date, tx.note || tx.title, tx.category_name || 'Uncategorized',
      names.get(tx.account_id) || 'Unassigned', tx.kind, tx.amount,
    ]),
  };
}

function budgetsTable(budgets, transactions) {
  return {
    title: 'Budgets',
    columns: ['Category', 'Month', 'Limit (JPY)', 'Spent (JPY)', 'Remaining (JPY)'],
    rows: budgets.map((budget) => {
      const status = getBudgetStatus(budget, transactions);
      return [budget.category_name || 'Uncategorized', monthOf(budget.budget_month),
        status.amount_limit, status.spent_amount, status.remaining_amount];
    }),
  };
}

function goalsTable(goals) {
  return {
    title: 'Savings goals (current)',
    columns: ['Goal', 'Target date', 'Target (JPY)', 'Saved (JPY)', 'Remaining (JPY)'],
    rows: goals.map((goal) => {
      const progress = calculateGoalProgress(goal);
      return [goal.title, goal.target_date || '—', goal.target_amount, goal.saved_amount, progress.remaining_amount];
    }),
  };
}

function nearestMonth(months, available) {
  const date = (month) => Date.parse(`${month}-01T00:00:00Z`);
  const distance = (month) => Math.min(...months.map((target) => Math.abs(date(month) - date(target))));
  return [...new Set(available)].sort((a, b) => distance(a) - distance(b) || b.localeCompare(a))[0];
}

function reportMonths(sections, transactions, categories) {
  const months = [...new Set(transactions.map((tx) => monthOf(tx.transaction_date)))];
  if (sections.includes('summary') || sections.includes('transactions')) return months;
  if (!sections.includes('categories')) return [];
  return months.filter((month) => buildFinanceReport({
    kind: 'categories', months: [month], transactions, categories,
  }).hasData);
}

export function buildChatExportReport(request, data) {
  const { months, kind, accountIds, categoryIds, sections } = request;
  const eligible = data.transactions.filter((tx) => (!kind || tx.kind === kind)
    && matches(accountIds, tx.account_id) && matches(categoryIds, tx.category_id));
  const transactions = eligible.filter((tx) => months.includes(monthOf(tx.transaction_date)));
  const availableBudgets = !accountIds.length && kind !== 'income'
    ? data.budgets.filter((budget) => matches(categoryIds, budget.category_id)) : [];
  const budgets = availableBudgets.filter((budget) => months.includes(monthOf(budget.budget_month)));
  const goals = !accountIds.length && !kind && !categoryIds.length ? data.goals : [];
  const tables = sections.flatMap((section) => {
    if (section === 'transactions') return transactionTable(transactions, data.accounts);
    if (section === 'budgets') return budgetsTable(budgets, eligible);
    if (section === 'goals') return goalsTable(goals);
    const periods = section === 'categories' ? months.map((month) => [month]) : [months];
    return periods.map((period) => {
      const table = buildFinanceReport({ kind: section, months: period, transactions, categories: data.categories });
      return { ...table, title: section === 'categories' ? `Category breakdown · ${table.period}` : 'Summary',
        rows: table.hasData ? table.rows : [] };
    });
  });
  const hasData = tables.some(({ rows }) => rows.length > 0);
  const available = hasData ? [] : reportMonths(sections, eligible, data.categories);
  if (!hasData && sections.includes('budgets')) available.push(...availableBudgets.map((budget) => monthOf(budget.budget_month)));
  return {
    title: 'Finance report', period: months.join(' to '), sections: tables,
    hasData,
    nearest: nearestMonth(months, available.filter((month) => !months.includes(month))),
  };
}
