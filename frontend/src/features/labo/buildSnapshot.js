import {
  calculateGoalProgress,
  getAccountTotals,
  getBudgetStatus,
  getCategoryBreakdown,
  getHealthScore,
  getMonthlySummary,
  getSafeToSpend,
} from "../../utils/financeMath";

/**
 * Builds the finance snapshot the LA-BO chat sends to the backend.
 * Every number here is calculated by the app's own financeMath engine —
 * the AI only phrases answers from these figures, it never invents any.
 */
export function buildFinanceSnapshot(finance, month, today) {
  const { transactions, budgets, bills, goals, accounts, categories, preferences } = finance;

  const summary = getMonthlySummary(transactions, month);
  const breakdown = getCategoryBreakdown(transactions, month, categories);
  const monthlyBudgets = budgets
    .filter((b) => String(b.budget_month || "").slice(0, 7) === month)
    .map((b) => getBudgetStatus(b, transactions, today));
  const health = getHealthScore({
    monthIncome: summary.income,
    monthExpense: summary.expense,
    monthlyBudgets,
    bills,
    accounts,
    transactions,
    today,
  });
  const safe = getSafeToSpend({
    accounts,
    transactions,
    monthIncome: summary.income,
    expectedMonthlyIncome: preferences?.expected_monthly_income,
    bills,
    goals,
    buffer: preferences?.minimum_buffer || 0,
    today,
  });
  const totals = getAccountTotals(accounts, transactions, today);

  return {
    month,
    currency: "JPY",
    income_jpy: summary.income,
    expense_jpy: summary.expense,
    net_jpy: summary.net,
    transaction_count_this_month: summary.count ?? undefined,
    health_score: health.score,
    safe_to_spend_per_day_jpy: safe.dailySafe,
    bills_still_due_jpy: safe.billsStillDue,
    days_left_in_month: safe.daysLeft,
    total_balance_all_accounts_jpy: totals.net,
    top_expense_categories: breakdown.items.slice(0, 5).map((item) => ({
      name: item.name,
      amount_jpy: item.amount,
      percent: item.percent,
    })),
    budgets: monthlyBudgets.slice(0, 8).map((b) => ({
      category: b.category_name || "Category",
      limit_jpy: Number(b.amount_limit || 0),
      spent_jpy: b.spent_amount,
      percent_used: b.progress_percent,
      over_budget: b.over_budget,
      over_pace: b.over_pace,
    })),
    goals: goals.slice(0, 5).map((g) => {
      const prog = calculateGoalProgress(g);
      return {
        name: g.title || g.name,
        saved_jpy: Number(g.saved_amount || 0),
        target_jpy: Number(g.target_amount || 0),
        percent: prog.progress_percent,
        status_label: prog.label || `${prog.progress_percent}%`,
      };
    }),
  };
}
