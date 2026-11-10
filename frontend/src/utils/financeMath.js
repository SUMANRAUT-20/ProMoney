import { addMonthsISO, daysBetweenISO } from './formatters.js';

// Multi-currency (Arpan, 2026-11-10): a transaction may be ENTERED in
// a foreign currency (tx.currency + tx.amount as entered) with its
// base-currency value snapshotted at entry time in tx.base_amount
// (converted at the live rate then — see services/fxRates.js). Every
// aggregation below uses the BASE value, so dashboard totals are
// always in the base currency and history never shifts when exchange
// rates move later. Legacy transactions have no base_amount and are
// already in base currency, so they fall back to tx.amount.
export function txBaseAmount(tx) {
  const num = Number(tx?.base_amount ?? tx?.amount ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export function getAccountBalance(account, transactions) {
  const base = Number(account?.manual_balance || 0);
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (String(tx.account_id) !== String(account.id)) continue;
    const amt = txBaseAmount(tx);
    if (tx.kind === 'income') income += amt;
    else if (tx.kind === 'expense') expense += amt;
  }
  return account.kind === 'credit_card' ? base + expense - income : base + income - expense;
}

export function getAccountTotals(accounts, transactions) {
  let held = 0;
  let owed = 0;
  for (const acc of accounts) {
    const bal = getAccountBalance(acc, transactions);
    if (acc.kind === 'credit_card') owed += bal;
    else held += bal;
  }
  return { held, owed, net: held - owed };
}

export function getMonthlySummary(transactions, month) {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (String(tx.transaction_date || '').slice(0, 7) !== month) continue;
    const amt = txBaseAmount(tx);
    if (tx.kind === 'income') income += amt;
    else if (tx.kind === 'expense') expense += amt;
  }
  return { income, expense, net: income - expense };
}

export function getBudgetStatus(budget, transactions) {
  const limit = Number(budget.amount_limit || 0);
  const month = String(budget.budget_month || '').slice(0, 7);
  let spent = 0;
  for (const tx of transactions) {
    if (tx.kind !== 'expense') continue;
    if (String(tx.transaction_date || '').slice(0, 7) !== month) continue;
    const sameId = String(tx.category_id) === String(budget.category_id);
    const sameName = budget.category_name && tx.category_name === budget.category_name;
    if (sameId || sameName) spent += txBaseAmount(tx);
  }
  const remaining = limit - spent;
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return {
    ...budget,
    spent_amount: spent,
    remaining_amount: remaining,
    progress_percent: pct,
    bar_percent: Math.min(100, pct),
    over_budget: spent > limit,
  };
}

export function getBillStatus(bill, today) {
  if (bill.is_paid) return 'paid';
  if (bill.due_date < today) return 'overdue';
  if (daysBetweenISO(today, bill.due_date) <= 7) return 'due_soon';
  return 'upcoming';
}

export function getMonthlySavingPace(transactions) {
  const byMonth = new Map();
  for (const tx of transactions) {
    const m = String(tx.transaction_date || '').slice(0, 7);
    if (!m) continue;
    const prev = byMonth.get(m) || 0;
    const delta = tx.kind === 'income' ? txBaseAmount(tx) : -txBaseAmount(tx);
    byMonth.set(m, prev + delta);
  }
  if (byMonth.size === 0) return 0;
  let total = 0;
  for (const net of byMonth.values()) total += net;
  return Math.round(total / byMonth.size);
}

export function getGoalForecast(goal, monthlyPace, today) {
  const remaining = Math.max(0, Number(goal.target_amount || 0) - Number(goal.saved_amount || 0));
  if (remaining === 0) {
    return { completed: true, monthsNeeded: 0, expectedDate: today, onTrack: true };
  }
  if (monthlyPace <= 0) {
    return { completed: false, monthsNeeded: null, expectedDate: null, onTrack: false };
  }
  const monthsNeeded = Math.ceil(remaining / monthlyPace);
  const expectedDate = addMonthsISO(today, monthsNeeded);
  const onTrack = goal.target_date ? expectedDate <= goal.target_date : true;
  return { completed: false, monthsNeeded, expectedDate, onTrack };
}

export function getSafeToSpend({ monthIncome, bills, goals, today }) {
  const [y, m, d] = today.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - d + 1);
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const billsStillDue = bills
    .filter((b) => !b.is_paid && b.due_date <= monthEnd)
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);
  const goalSavingPlan = goals
    .filter((g) => Number(g.saved_amount || 0) < Number(g.target_amount || 0))
    .reduce((acc, g) => acc + Number(g.monthly_plan || 0), 0);
  const availablePool = monthIncome - billsStillDue - goalSavingPlan;
  return {
    dailySafe: Math.max(0, Math.floor(availablePool / daysLeft)),
    availablePool,
    billsStillDue,
    goalSavingPlan,
    daysLeft,
  };
}

export function getBalanceProjection({ netBalance, monthExpense, today }) {
  const [y, m, d] = today.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyPace = monthExpense / Math.max(1, d);
  const projectedRemaining = Math.round(dailyPace * Math.max(0, daysInMonth - d));
  const projectedEndBalance = netBalance - projectedRemaining;
  return {
    dailyPace: Math.round(dailyPace),
    projectedRemaining,
    projectedEndBalance,
    goesNegative: projectedEndBalance < 0,
  };
}

export function getHealthScore({ monthIncome, monthExpense, monthlyBudgets, bills, today }) {
  const rate = monthIncome > 0 ? Math.max(0, (monthIncome - monthExpense) / monthIncome) : 0;
  const savingsPts = Math.min(40, Math.round((rate / 0.2) * 40));
  const withinCount = monthlyBudgets.filter((b) => !b.over_budget).length;
  const budgetPts = monthlyBudgets.length > 0 ? Math.round((withinCount / monthlyBudgets.length) * 30) : 0;
  const overdueCount = bills.filter((b) => getBillStatus(b, today) === 'overdue').length;
  const billPts = bills.length > 0 ? Math.round(((bills.length - overdueCount) / bills.length) * 30) : 30;
  return { score: savingsPts + budgetPts + billPts, savingsPts, budgetPts, billPts };
}

export function getCategoryBreakdown(transactions, month, categories) {
  const totals = new Map();
  let totalExpense = 0;
  for (const tx of transactions) {
    if (tx.kind !== 'expense' || String(tx.transaction_date || '').slice(0, 7) !== month) continue;
    const cat = categories.find((c) => String(c.id) === String(tx.category_id));
    const key = cat?.id || tx.category_id || tx.category_name || 'other-expense';
    const name = cat?.name || tx.category_name || 'Other Expense';
    const amt = txBaseAmount(tx);
    totalExpense += amt;
    totals.set(key, { id: key, name, amount: (totals.get(key)?.amount || 0) + amt });
  }
  return {
    totalExpense,
    items: [...totals.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        ...item,
        percent: totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0,
      })),
  };
}

export function getMonthlySavingsSeries(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    const month = String(tx.transaction_date || '').slice(0, 7);
    if (!month) continue;
    const entry = map.get(month) || { month, income: 0, expense: 0 };
    if (tx.kind === 'income') entry.income += txBaseAmount(tx);
    else if (tx.kind === 'expense') entry.expense += txBaseAmount(tx);
    map.set(month, entry);
  }
  const months = [...map.keys()].sort();
  let cumulative = 0;
  return months.map((m) => {
    const { income, expense } = map.get(m);
    const net = income - expense;
    cumulative += net;
    return { month: m, income, expense, net, cumulative };
  });
}
