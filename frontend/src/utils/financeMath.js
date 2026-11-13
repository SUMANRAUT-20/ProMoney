/**
 * ProMoney Layer 1 Engine — Shared Finance Core (financeMath)
 * Mirrors backend/src/services/financeMath.js so every frontend view,
 * report, and LA-BO snapshot uses the exact same Constitution v2 engine.
 */

export const ASSET_ACCOUNT_KINDS = ['cash', 'bank', 'digital', 'prepaid', 'savings'];
export const LIABILITY_ACCOUNT_KINDS = ['credit_card', 'card', 'bnpl', 'loan'];
export const SPENDABLE_ACCOUNT_KINDS = ['cash', 'bank', 'digital', 'prepaid'];
export const REFUND_KINDS = ['refund', 'reimbursement', 'cashback'];
export const TRANSFER_KINDS = ['transfer', 'card_payment', 'goal_contribution', 'goal_withdrawal'];

export function yen(n) {
  const value = Number(n);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Expected nonnegative integer JPY');
  }
  return value;
}

export function positiveYen(n) {
  const value = Number(n);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Expected positive integer JPY');
  }
  return value;
}

export function iso(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error('Expected YYYY-MM-DD');
  }
  const x = new Date(d + 'T00:00:00Z');
  if (Number.isNaN(x.valueOf()) || x.toISOString().slice(0, 10) !== d) {
    throw new Error('Invalid calendar date');
  }
  return d;
}

export function tokyoTodayISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function daysBetweenISO(fromISO, toISO) {
  const [y1, m1, d1] = String(fromISO).split('-').map(Number);
  const [y2, m2, d2] = String(toISO).split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86400000);
}

export function addMonthsISO(isoDate, months) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function monthBounds(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Expected YYYY-MM');
  }
  const [year, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const next = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, endExclusive: next };
}

export function isLiabilityAccount(account) {
  const kind = String(account?.kind || '').toLowerCase();
  const group = String(account?.ui_details?.group || '').toLowerCase();
  return LIABILITY_ACCOUNT_KINDS.includes(kind) || ['credit', 'bnpl', 'loan'].includes(group);
}

export function isSpendableAccount(account) {
  if (isLiabilityAccount(account)) return false;
  const kind = String(account?.kind || 'cash').toLowerCase();
  const group = String(account?.ui_details?.group || '').toLowerCase();
  if (kind === 'savings' || group === 'savings' || group === 'loan_asset') return false;
  return SPENDABLE_ACCOUNT_KINDS.includes(kind);
}

export function resolvePaymentAccountId(txOrInput, accounts = []) {
  if (txOrInput?.account_id) {
    const chosen = accounts.find((a) => String(a.id) === String(txOrInput.account_id));
    if (chosen?.parent_bank_account_id) return chosen.parent_bank_account_id;
    return txOrInput.account_id;
  }
  if (txOrInput?.payment_method === 'debit') {
    const bankAcc = accounts.find((a) => a.kind === 'bank');
    if (bankAcc) return bankAcc.id;
  }
  return txOrInput?.account_id ?? null;
}

export function getAccountBalance(account, transactions = [], asOfDate = null) {
  const base = Number(account?.manual_balance ?? account?.opening_balance ?? 0);
  const accId = String(account?.id ?? '');
  const liability = isLiabilityAccount(account);

  let delta = 0;
  for (const tx of transactions) {
    const txDate = String(tx.transaction_date || '').slice(0, 10);
    if (asOfDate && txDate > asOfDate) continue;

    const amt = Number(tx.amount || 0);
    const kind = String(tx.kind || '');
    const fromMatch = String(tx.account_id ?? '') === accId;
    const toMatch = String(tx.to_account_id ?? '') === accId;

    if (!fromMatch && !toMatch) continue;

    if (kind === 'income') {
      if (fromMatch) delta += liability ? -amt : amt;
    } else if (kind === 'expense') {
      if (fromMatch) delta += liability ? amt : -amt;
    } else if (REFUND_KINDS.includes(kind)) {
      if (fromMatch) delta += liability ? -amt : amt;
    } else if (TRANSFER_KINDS.includes(kind)) {
      if (fromMatch) delta += liability ? amt : -amt;
      if (toMatch) delta += liability ? -amt : amt;
    } else if (kind === 'adjustment') {
      if (fromMatch) {
        const sign = tx.direction === 'decrease' ? -1 : 1;
        delta += sign * amt;
      }
    }
  }

  return base + delta;
}

export function getAccountTotals(accounts = [], transactions = [], asOfDate = null) {
  let held = 0;
  let owed = 0;
  let spendable = 0;
  for (const acc of accounts) {
    if (acc?.kind === 'debit_card' && acc?.parent_bank_account_id) continue;
    const bal = getAccountBalance(acc, transactions, asOfDate);
    if (isLiabilityAccount(acc)) {
      owed += bal;
    } else {
      held += bal;
      if (isSpendableAccount(acc)) spendable += bal;
    }
  }
  return { held, owed, spendable, net: held - owed };
}

export function buildQuickAddTransaction({ amount, category_id, category_name, note }, accounts = [], today = tokyoTodayISO()) {
  const val = positiveYen(amount);
  const cashAcc = accounts.find((a) => a.kind === 'cash') || accounts[0] || null;
  const cleanNote = String(note || category_name || 'Quick expense').trim();
  return {
    kind: 'expense',
    amount: val,
    category_id,
    category_name: category_name || null,
    account_id: cashAcc ? cashAcc.id : null,
    transaction_date: iso(today),
    title: cleanNote,
    note: cleanNote,
  };
}

export function normalizeSalaryAmount({ amount, gross_amount, deductions = 0 }) {
  if (gross_amount !== undefined && gross_amount !== null) {
    const gross = positiveYen(gross_amount);
    const ded = yen(deductions);
    if (ded >= gross) throw new Error('Deductions must be less than gross salary');
    return gross - ded;
  }
  return positiveYen(amount);
}

export function calculateMonthlySummary(transactions, month) {
  const { start, endExclusive } = monthBounds(month);
  let income_amount = 0;
  let expense_amount = 0;
  for (const tx of transactions) {
    const day = iso(tx.transaction_date);
    if (day < start || day >= endExclusive) continue;
    const value = yen(tx.amount);
    if (tx.kind === 'income') {
      income_amount += value;
    } else if (tx.kind === 'expense') {
      expense_amount += value;
    } else if (REFUND_KINDS.includes(tx.kind)) {
      expense_amount -= value;
    } else if (TRANSFER_KINDS.includes(tx.kind) || tx.kind === 'adjustment') {
      continue;
    } else {
      throw new Error('Invalid transaction kind');
    }
  }
  expense_amount = Math.max(0, expense_amount);
  if (!Number.isSafeInteger(income_amount) || !Number.isSafeInteger(expense_amount)) {
    throw new Error('Unsafe total');
  }
  return {
    income_amount,
    expense_amount,
    net_amount: income_amount - expense_amount,
  };
}

export function getMonthlySummary(transactions = [], month) {
  let income = 0;
  let expense = 0;
  let adjustment_amount = 0;
  let count = 0;
  for (const tx of transactions) {
    if (String(tx.transaction_date || '').slice(0, 7) !== month) continue;
    const amt = Number(tx.amount || 0);
    if (tx.kind === 'income') {
      income += amt;
      count += 1;
    } else if (tx.kind === 'expense') {
      expense += amt;
      count += 1;
    } else if (REFUND_KINDS.includes(tx.kind)) {
      expense -= amt;
      count += 1;
    } else if (tx.kind === 'adjustment') {
      const sign = tx.direction === 'decrease' ? -1 : 1;
      adjustment_amount += sign * amt;
      count += 1;
    }
  }
  expense = Math.max(0, expense);
  return { income, expense, net: income - expense, adjustment_amount, count };
}

export function reconcilePeriodNetWorth(accounts = [], transactions = [], month) {
  const { start, endExclusive } = monthBounds(month);
  const startDt = new Date(start + 'T00:00:00Z');
  startDt.setUTCDate(startDt.getUTCDate() - 1);
  const beforeDate = startDt.toISOString().slice(0, 10);

  const endDt = new Date(endExclusive + 'T00:00:00Z');
  endDt.setUTCDate(endDt.getUTCDate() - 1);
  const afterDate = endDt.toISOString().slice(0, 10);

  const beforeTotals = getAccountTotals(accounts, transactions, beforeDate);
  const afterTotals = getAccountTotals(accounts, transactions, afterDate);
  const summary = getMonthlySummary(transactions, month);

  const netWorthChange = afterTotals.net - beforeTotals.net;
  const expectedFlow = summary.income - summary.expense + summary.adjustment_amount;

  return {
    income_amount: summary.income,
    expense_amount: summary.expense,
    adjustment_amount: summary.adjustment_amount,
    expected_flow: expectedFlow,
    net_worth_before: beforeTotals.net,
    net_worth_after: afterTotals.net,
    net_worth_change: netWorthChange,
    reconciled: netWorthChange === expectedFlow,
  };
}

export function calculateBudgetProgress(budget, transactions) {
  const limit = yen(budget.amount_limit);
  if (limit === 0) throw new Error('Budget must be positive');
  const month = String(budget.budget_month).slice(0, 7);
  const { start, endExclusive } = monthBounds(month);
  let spent_amount = 0;
  for (const tx of transactions) {
    const day = iso(tx.transaction_date);
    if (day < start || day >= endExclusive) continue;
    const sameCat =
      String(tx.category_id) === String(budget.category_id) ||
      (budget.category_name && tx.category_name && tx.category_name === budget.category_name);
    if (!sameCat) continue;
    if (tx.kind === 'expense') {
      spent_amount += yen(tx.amount);
    } else if (REFUND_KINDS.includes(tx.kind)) {
      spent_amount -= yen(tx.amount);
    }
  }
  spent_amount = Math.max(0, spent_amount);
  if (!Number.isSafeInteger(spent_amount)) throw new Error('Unsafe total');
  const remaining_amount = limit - spent_amount;
  const progress_percent = Math.round((spent_amount / limit) * 100);
  return {
    spent_amount,
    remaining_amount,
    progress_percent,
    bar_percent: Math.min(progress_percent, 100),
    over_budget: spent_amount > limit,
  };
}

export function calculateBudgetPace(budget, transactions = [], today = tokyoTodayISO()) {
  const limit = Number(budget?.amount_limit || 0);
  const month = String(budget?.budget_month || '').slice(0, 7);
  const todayMonth = String(today).slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 30;

  let daysPassed = daysInMonth;
  if (todayMonth === month) {
    daysPassed = Math.min(daysInMonth, Math.max(1, Number(String(today).slice(8, 10))));
  } else if (todayMonth < month) {
    daysPassed = 0;
  }

  const expected_spend = limit > 0 ? Math.round((limit * daysPassed) / daysInMonth) : 0;
  let spent = 0;
  for (const tx of transactions) {
    if (String(tx.transaction_date || '').slice(0, 7) !== month) continue;
    const sameId = String(tx.category_id) === String(budget.category_id);
    const sameName = budget.category_name && tx.category_name === budget.category_name;
    if (!sameId && !sameName) continue;
    if (tx.kind === 'expense') spent += Number(tx.amount || 0);
    else if (REFUND_KINDS.includes(tx.kind)) spent -= Number(tx.amount || 0);
  }
  spent = Math.max(0, spent);
  const over_pace = limit > 0 && daysPassed > 0 && spent > expected_spend;
  return {
    expected_spend,
    spent_amount: spent,
    days_passed: daysPassed,
    days_in_month: daysInMonth,
    over_pace,
    pace_label: over_pace ? 'A bit fast this month' : 'On track',
  };
}

export function getBudgetStatus(budget, transactions = [], today = tokyoTodayISO()) {
  const limit = Number(budget.amount_limit || 0);
  const month = String(budget.budget_month || '').slice(0, 7);
  let spent = 0;
  for (const tx of transactions) {
    if (String(tx.transaction_date || '').slice(0, 7) !== month) continue;
    const sameId = String(tx.category_id) === String(budget.category_id);
    const sameName = budget.category_name && tx.category_name === budget.category_name;
    if (!sameId && !sameName) continue;
    if (tx.kind === 'expense') spent += Number(tx.amount || 0);
    else if (REFUND_KINDS.includes(tx.kind)) spent -= Number(tx.amount || 0);
  }
  spent = Math.max(0, spent);
  const remaining = limit - spent;
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  const remainingPct = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
  const pace = calculateBudgetPace(budget, transactions, today);

  return {
    ...budget,
    spent_amount: spent,
    remaining_amount: remaining,
    remaining_percent: remainingPct,
    progress_percent: pct,
    bar_percent: Math.min(100, Math.max(0, pct)),
    over_budget: spent > limit,
    expected_spend: pace.expected_spend,
    over_pace: pace.over_pace,
    pace_label: pace.pace_label,
  };
}

export function calculateGoalProgress(goal) {
  const target = yen(goal?.target_amount ?? 0);
  const saved = yen(goal?.saved_amount ?? 0);
  const plan = yen(goal?.monthly_plan ?? 0);
  if (target === 0) {
    return {
      saved_amount: saved,
      remaining_amount: 0,
      progress_percent: null,
      bar_percent: 0,
      monthly_plan: plan,
      completed: false,
      label: 'Set a target',
    };
  }
  const progress_percent = Math.round((saved / target) * 100);
  return {
    saved_amount: saved,
    remaining_amount: Math.max(0, target - saved),
    progress_percent,
    bar_percent: Math.min(progress_percent, 100),
    monthly_plan: plan,
    completed: saved >= target,
  };
}

export function getMonthlySavingPace(transactions = []) {
  const byMonth = new Map();
  for (const tx of transactions) {
    const m = String(tx.transaction_date || '').slice(0, 7);
    if (!m) continue;
    const prev = byMonth.get(m) || 0;
    let delta = 0;
    if (tx.kind === 'income') delta = Number(tx.amount || 0);
    else if (tx.kind === 'expense') delta = -Number(tx.amount || 0);
    else if (REFUND_KINDS.includes(tx.kind)) delta = Number(tx.amount || 0);
    else continue;
    byMonth.set(m, prev + delta);
  }
  if (byMonth.size === 0) return 0;
  const sortedMonths = [...byMonth.keys()].sort().slice(-3);
  let total = 0;
  for (const m of sortedMonths) total += byMonth.get(m);
  return Math.round(total / sortedMonths.length);
}

export function getGoalForecast(goal, monthlyPace = 0, today = tokyoTodayISO()) {
  const target = Number(goal?.target_amount || 0);
  const saved = Number(goal?.saved_amount || 0);
  if (target <= 0) {
    return {
      completed: false,
      monthsNeeded: null,
      expectedDate: null,
      onTrack: false,
      label: 'Set a target',
    };
  }
  const remaining = Math.max(0, target - saved);
  if (remaining === 0) {
    return { completed: true, monthsNeeded: 0, expectedDate: today, onTrack: true, label: 'Completed' };
  }
  const effectivePace = Number(goal?.monthly_plan || 0) > 0 && monthlyPace <= 0
    ? Number(goal.monthly_plan)
    : monthlyPace;
  if (effectivePace <= 0) {
    return {
      completed: false,
      monthsNeeded: null,
      expectedDate: null,
      onTrack: false,
      label: 'no date yet',
    };
  }
  const monthsNeeded = Math.ceil(remaining / effectivePace);
  const expectedDate = addMonthsISO(today, monthsNeeded);
  const onTrack = goal.target_date ? expectedDate <= goal.target_date : true;
  return { completed: false, monthsNeeded, expectedDate, onTrack, label: expectedDate };
}

export function getBillStatus(bill, today = tokyoTodayISO(), dueSoonDays = 7) {
  if (bill.is_paid) return 'paid';
  if (bill.due_date < today) return 'overdue';
  if (daysBetweenISO(today, bill.due_date) <= dueSoonDays) return 'due_soon';
  return 'upcoming';
}

export function getSafeToSpend({
  accounts = null,
  transactions = [],
  spendable: explicitSpendable = undefined,
  monthIncome = 0,
  expectedMonthlyIncome = null,
  bills = [],
  goals = [],
  buffer = 0,
  today = tokyoTodayISO(),
}) {
  const [y, m, d] = String(today).split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - d + 1);
  const monthStr = `${y}-${String(m).padStart(2, '0')}`;
  const monthEnd = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const computedSpendable =
    explicitSpendable !== undefined
      ? Number(explicitSpendable)
      : Array.isArray(accounts) && accounts.length > 0
        ? getAccountTotals(accounts, transactions, today).spendable
        : Number(monthIncome || 0);

  const incomeStillExpected =
    expectedMonthlyIncome !== null && expectedMonthlyIncome !== undefined
      ? Math.max(0, Number(expectedMonthlyIncome) - Number(monthIncome || 0))
      : 0;

  const futureExpensesThisMonth = transactions
    .filter((tx) => {
      const txDate = String(tx.transaction_date || '').slice(0, 10);
      return tx.kind === 'expense' && txDate > today && txDate <= monthEnd;
    })
    .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);

  const billsStillDue = bills
    .filter((b) => !b.is_paid && b.due_date <= monthEnd)
    .reduce((acc, b) => acc + Number(b.amount || 0), 0);

  const goalSavingPlan = goals
    .filter((g) => Number(g.target_amount || 0) > 0 && Number(g.saved_amount || 0) < Number(g.target_amount || 0))
    .reduce((acc, g) => acc + Number(g.monthly_plan || 0), 0);

  const safeBuffer = Math.max(0, Number(buffer || 0));
  const availablePool =
    computedSpendable +
    incomeStillExpected -
    futureExpensesThisMonth -
    billsStillDue -
    goalSavingPlan -
    safeBuffer;

  const dailySafe = Math.floor(availablePool / daysLeft);

  return {
    dailySafe,
    availablePool,
    safeToSpendMonth: availablePool,
    spendable: computedSpendable,
    incomeStillExpected,
    futureExpensesThisMonth,
    billsStillDue,
    goalSavingPlan,
    buffer: safeBuffer,
    daysLeft,
    overPlan: availablePool < 0,
  };
}

export function getEngineAlerts({
  budgets = [],
  transactions = [],
  bills = [],
  goals = [],
  safeToSpend = null,
  settings = {},
  today = tokyoTodayISO(),
}) {
  const warningPct = Number(settings?.budget_warning_percent ?? 20);
  const billWindow = Number(settings?.bill_reminder_days ?? 3);
  const switches = {
    budget: true,
    pace: true,
    bills: true,
    goals: true,
    ...(settings?.warning_switches || {}),
  };

  const alerts = [];
  const month = String(today).slice(0, 7);

  if (switches.bills) {
    for (const bill of bills) {
      if (!bill.is_paid && bill.due_date < today) {
        const daysLate = Math.abs(daysBetweenISO(today, bill.due_date));
        alerts.push({
          rank: 1,
          kind: 'overdue_bill',
          severity: 'danger',
          title: `${bill.name} is overdue by ${daysLate} ${daysLate === 1 ? 'day' : 'days'}`,
          amount: Number(bill.amount || 0),
        });
      }
    }
  }

  if (safeToSpend && safeToSpend.availablePool < 0) {
    alerts.push({
      rank: 2,
      kind: 'safe_to_spend_negative',
      severity: 'danger',
      title: `Safe-to-spend is over plan (${safeToSpend.availablePool} JPY)`,
      amount: safeToSpend.availablePool,
    });
  }

  const monthlyBudgets = budgets
    .filter((b) => String(b.budget_month || '').slice(0, 7) === month)
    .map((b) => getBudgetStatus(b, transactions, today));

  for (const b of monthlyBudgets) {
    const catName = b.category_name || 'Category';
    if (switches.budget && b.amount_limit > 0 && b.remaining_percent <= warningPct) {
      alerts.push({
        rank: 3,
        kind: 'budget_threshold',
        severity: b.over_budget ? 'danger' : 'warning',
        title: b.over_budget
          ? `${catName}: over budget by ¥${Math.abs(b.remaining_amount).toLocaleString('ja-JP')}`
          : `${catName}: only ${Math.max(0, b.remaining_percent)}% of the budget is left`,
        category_id: b.category_id,
      });
    } else if (switches.pace && b.over_pace) {
      alerts.push({
        rank: 4,
        kind: 'over_pace',
        severity: 'warning',
        title: `${catName} is a bit fast this month`,
        category_id: b.category_id,
      });
    }
  }

  if (switches.bills) {
    for (const bill of bills) {
      if (bill.is_paid) continue;
      const diff = daysBetweenISO(today, bill.due_date);
      if (diff >= 0 && diff <= billWindow) {
        alerts.push({
          rank: 5,
          kind: 'bill_due_soon',
          severity: 'warning',
          title: diff === 0 ? `${bill.name} is due today` : `${bill.name} is due in ${diff} ${diff === 1 ? 'day' : 'days'}`,
          amount: Number(bill.amount || 0),
        });
      }
    }
  }

  if (switches.goals) {
    const pace = getMonthlySavingPace(transactions);
    for (const goal of goals) {
      if (Number(goal.target_amount || 0) <= 0) continue;
      const forecast = getGoalForecast(goal, pace, today);
      if (!forecast.completed && goal.target_date && !forecast.onTrack) {
        alerts.push({
          rank: 6,
          kind: 'goal_slipping',
          severity: 'warning',
          title: `${goal.title} is behind schedule for its deadline`,
          goal_id: goal.id,
        });
      }
    }
  }

  return alerts.sort((a, b) => a.rank - b.rank);
}

export function getBalanceProjection({ netBalance, monthExpense, today = tokyoTodayISO() }) {
  const [y, m, d] = String(today).split('-').map(Number);
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

export function getHealthScore({
  monthIncome = 0,
  monthExpense = 0,
  monthlyBudgets = [],
  bills = [],
  accounts = [],
  transactions = [],
  spendable: explicitSpendable = undefined,
  totalAssets: explicitAssets = undefined,
  totalLiabilities: explicitLiabilities = undefined,
  today = tokyoTodayISO(),
}) {
  const rate = monthIncome > 0 ? Math.max(0, (monthIncome - monthExpense) / monthIncome) : 0;
  const savingsPts = Math.min(30, Math.round((rate / 0.2) * 30));

  let budgetPts = 15;
  if (monthlyBudgets.length > 0) {
    const withinCount = monthlyBudgets.filter((b) => !b.over_budget).length;
    budgetPts = Math.round((withinCount / monthlyBudgets.length) * 30);
  }

  const totals =
    explicitAssets !== undefined && explicitLiabilities !== undefined
      ? {
          held: Number(explicitAssets),
          owed: Number(explicitLiabilities),
          spendable: explicitSpendable !== undefined ? Number(explicitSpendable) : Number(explicitAssets),
        }
      : getAccountTotals(accounts, transactions, today);

  const assets = totals.held;
  const liabilities = totals.owed;
  const spendable = explicitSpendable !== undefined ? Number(explicitSpendable) : totals.spendable;

  let debtPts = 20;
  if (liabilities > 0) {
    if (assets <= 0) {
      debtPts = 0;
    } else {
      const debtRatio = liabilities / assets;
      debtPts = Math.max(0, Math.min(20, Math.round((1 - debtRatio) * 20)));
    }
  }

  const unpaidNext30d = bills.filter((b) => {
    if (b.is_paid) return false;
    const diff = daysBetweenISO(today, b.due_date);
    return diff <= 30;
  });
  const billsNext30dAmount = unpaidNext30d.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const overdueCount = bills.filter((b) => getBillStatus(b, today) === 'overdue').length;

  let billPts = 20;
  if (billsNext30dAmount > 0) {
    const hasAccountContext =
      explicitSpendable !== undefined || (Array.isArray(accounts) && accounts.length > 0);
    if (hasAccountContext) {
      const coverage = Math.min(1, Math.max(0, spendable) / billsNext30dAmount);
      billPts = Math.round(coverage * 20);
      if (overdueCount > 0) billPts = Math.max(0, billPts - overdueCount * 5);
    } else if (bills.length > 0) {
      billPts = Math.round(((bills.length - overdueCount) / bills.length) * 20);
    }
  }

  const score = savingsPts + budgetPts + debtPts + billPts;

  const ratios = [
    { part: 'savings', ratio: savingsPts / 30 },
    { part: 'budgets', ratio: budgetPts / 30 },
    { part: 'debt', ratio: debtPts / 20 },
    { part: 'bills', ratio: billPts / 20 },
  ].sort((a, b) => a.ratio - b.ratio);

  return {
    score,
    savingsPts,
    budgetPts,
    debtPts,
    billPts,
    weakestPart: ratios[0].part,
  };
}

export function getCategoryBreakdown(transactions = [], month, categories = []) {
  const totals = new Map();
  for (const tx of transactions) {
    if (String(tx.transaction_date || '').slice(0, 7) !== month) continue;
    if (tx.kind !== 'expense' && !REFUND_KINDS.includes(tx.kind)) continue;
    const cat = categories.find((c) => String(c.id) === String(tx.category_id));
    const key = cat?.id || tx.category_id || tx.category_name || 'other-expense';
    const name = cat?.name || tx.category_name || 'Other Expense';
    const amt = Number(tx.amount || 0);
    const delta = tx.kind === 'expense' ? amt : -amt;
    const prev = totals.get(key)?.amount || 0;
    totals.set(key, { id: key, name, amount: prev + delta });
  }

  const positiveItems = [...totals.values()]
    .map((item) => ({ ...item, amount: Math.max(0, item.amount) }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const totalExpense = positiveItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    totalExpense,
    items: positiveItems.map((item) => ({
      ...item,
      percent: totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0,
    })),
  };
}

export function getAccountTransactions(accountId, transactions = []) {
  const idStr = String(accountId);
  return transactions.filter(
    (tx) => String(tx.account_id) === idStr || String(tx.to_account_id) === idStr
  );
}

export function getMonthlySavingsSeries(transactions = []) {
  const map = new Map();
  for (const tx of transactions) {
    const month = String(tx.transaction_date || '').slice(0, 7);
    if (!month) continue;
    const entry = map.get(month) || { month, income: 0, expense: 0 };
    if (tx.kind === 'income') entry.income += Number(tx.amount || 0);
    else if (tx.kind === 'expense') entry.expense += Number(tx.amount || 0);
    else if (REFUND_KINDS.includes(tx.kind)) entry.expense -= Number(tx.amount || 0);
    else continue;
    map.set(month, entry);
  }
  const months = [...map.keys()].sort();
  let cumulative = 0;
  return months.map((m) => {
    const raw = map.get(m);
    const income = raw.income;
    const expense = Math.max(0, raw.expense);
    const net = income - expense;
    cumulative += net;
    return { month: m, income, expense, net, cumulative };
  });
}
