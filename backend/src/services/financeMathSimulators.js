import {
  addMonthsISO, daysBetweenISO, getAccountBalance, getAccountTotals, getGoalForecast, getMonthlySavingPace,
  getMonthlySummary, getSafeToSpend, isSpendableAccount, REFUND_KINDS, tokyoTodayISO,
} from './financeMath.js';
import { getLiabilities, scenarioYen } from './financeMathLoans.js';

function activeGoal(goals) {
  return goals.filter((goal) => goal.target_amount > goal.saved_amount)
    .sort((a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999'))[0];
}

function planState({ accounts, transactions, bills, goals, preferences }, today) {
  const month = today.slice(0, 7);
  const totals = getAccountTotals(accounts, transactions, today);
  const goal = activeGoal(goals);
  const history = transactions.filter((tx) => tx.transaction_date < month + '-01'
    && (tx.kind === 'income' || tx.kind === 'expense' || REFUND_KINDS.includes(tx.kind)));
  const monthlyNet = getMonthlySavingPace(history);
  const goalPace = goal?.monthly_plan || Math.max(0, monthlyNet);
  const base = {
    transactions, bills, goals, today, spendable: totals.spendable,
    monthIncome: getMonthlySummary(transactions, month).income,
    expectedMonthlyIncome: preferences.expected_monthly_income,
    buffer: preferences.minimum_buffer,
  };
  return { base, totals, goal, goalPace, monthlyNet, hasHistory: history.length > 0 };
}

function forecastDate(goal, pace, today, diverted = 0) {
  if (!goal || pace <= 0) return null;
  const remaining = goal.target_amount - goal.saved_amount + diverted;
  const [year, month] = today.split('-').map(Number);
  if (remaining > pace * ((9999 - year) * 12 + 12 - month)) return null;
  return getGoalForecast({ ...goal, target_amount: goal.target_amount + diverted }, pace, today).expectedDate;
}

export function checkPurchase(data, price, today = tokyoTodayISO()) {
  const amount = scenarioYen(price);
  if (amount === 0) throw new RangeError('Enter a positive item price.');
  const { base, goal, goalPace } = planState(data, today);
  const before = getSafeToSpend(base);
  const after = getSafeToSpend({ ...base, spendable: base.spendable - amount });
  const covered = after.availablePool + after.goalSavingPlan >= 0;
  const cashCover = after.spendable - after.futureExpensesThisMonth - after.billsStillDue - after.buffer;
  const diverted = Math.min(amount, Math.max(0, amount - Math.max(0, before.availablePool)));
  const currentDate = forecastDate(goal, goalPace, today);
  const newDate = forecastDate(goal, goalPace, today, diverted);
  return {
    amount,
    before: before.dailySafe,
    after: after.dailySafe,
    remaining: after.availablePool,
    bills: after.billsStillDue,
    buffer: after.buffer,
    covered,
    verdict: !covered ? 'Would break the plan' : (after.overPlan || cashCover < 0 ? 'Tight' : 'Comfortable'),
    goal: goal?.title ?? null,
    goalDelayDays: currentDate && newDate ? daysBetweenISO(currentDate, newDate) : null,
  };
}

export function projectWhatIf(data, { moreIncome, lessSpending, categoryId }, today = tokyoTodayISO()) {
  const gain = scenarioYen(moreIncome);
  const cut = scenarioYen(lessSpending);
  const category = data.categories?.find((item) => String(item.id) === String(categoryId) && item.kind === 'expense');
  if (cut > 0 && !category) throw new RangeError('Choose an existing expense category or add one on Transactions.');
  const { totals, goal, goalPace, monthlyNet, hasHistory } = planState(data, today);
  const delta = gain + cut;
  const project = (net) => [1, 2, 3].map((months) => ({
    month: addMonthsISO(today, months).slice(0, 7),
    balance: totals.net + months * net,
  }));
  return {
    goal: goal?.title ?? null,
    currentDate: forecastDate(goal, goalPace, today),
    scenarioDate: forecastDate(goal, goalPace + delta, today),
    hasHistory,
    currentTrend: project(monthlyNet),
    scenarioTrend: project(monthlyNet + delta),
  };
}

export function allocateSurplus(data, today = tokyoTodayISO()) {
  const { base, totals, goal } = planState(data, today);
  const { buffer, futureExpensesThisMonth } = getSafeToSpend(base);
  const upcomingBills = data.bills.reduce((sum, bill) => sum + (bill.is_paid ? 0 : bill.amount), 0);
  const savedForGoals = data.goals.reduce((sum, item) => sum + item.saved_amount, 0);
  const surplus = totals.held - upcomingBills - buffer;
  const available = Math.max(0, Math.min(surplus - savedForGoals, totals.spendable - upcomingBills - buffer - futureExpensesThisMonth));
  const topDebt = getLiabilities(data.accounts, data.transactions, today).sort((a, b) => b.balance - a.balance)[0];
  const source = data.accounts.filter(isSpendableAccount)
    .map((account) => ({ ...account, balance: getAccountBalance(account, data.transactions, today, data.accounts) }))
    .sort((a, b) => b.balance - a.balance)[0];
  const goalAmount = goal ? Math.min(available, goal.target_amount - goal.saved_amount) : 0;
  const debtAmount = topDebt && source ? Math.max(0, Math.min(topDebt.balance, source.balance, available - goalAmount)) : 0;
  return {
    surplus, upcomingBills, buffer, unallocated: available - goalAmount - debtAmount,
    proposals: [
      ...(goalAmount ? [{ kind: 'goal', id: goal.id, name: goal.title, amount: goalAmount }] : []),
      ...(debtAmount ? [{ kind: 'debt', id: topDebt.id, name: topDebt.name, amount: debtAmount,
        sourceId: source.id, sourceName: source.name, date: today }] : []),
    ],
  };
}
