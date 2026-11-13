import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthBounds,
  calculateMonthlySummary,
  calculateBudgetProgress,
  calculateBudgetPace,
  calculateGoalProgress,
  getAccountBalance,
  getAccountTotals,
  getAccountTransactions,
  getBudgetStatus,
  getCategoryBreakdown,
  getEngineAlerts,
  getGoalForecast,
  getHealthScore,
  getMonthlySavingPace,
  getMonthlySummary,
  getSafeToSpend,
  buildQuickAddTransaction,
  normalizeSalaryAmount,
  reconcilePeriodNetWorth,
  resolvePaymentAccountId,
} from '../src/services/financeMath.js';

const tx = [
  { kind: 'income', amount: 300000, category_id: '1', transaction_date: '2026-10-01' },
  { kind: 'expense', amount: 25000, category_id: '2', transaction_date: '2026-10-19' },
  { kind: 'expense', amount: 5000, category_id: '3', transaction_date: '2026-10-20' },
  { kind: 'expense', amount: 9999, category_id: '2', transaction_date: '2026-09-30' },
];

// --- Baseline tests ---

test('October month boundaries including December rollover', () => {
  assert.deepEqual(monthBounds('2026-10'), { start: '2026-10-01', endExclusive: '2026-11-01' });
  assert.equal(monthBounds('2026-12').endExclusive, '2027-01-01');
});

test('Income, expenses, and net use selected period only', () =>
  assert.deepEqual(calculateMonthlySummary(tx, '2026-10'), {
    income_amount: 300000,
    expense_amount: 30000,
    net_amount: 270000,
  }));

test('Budget includes expense rows only in same category and month', () =>
  assert.deepEqual(
    calculateBudgetProgress({ category_id: '2', budget_month: '2026-10-01', amount_limit: 40000 }, tx),
    { spent_amount: 25000, remaining_amount: 15000, progress_percent: 63, bar_percent: 63, over_budget: false }
  ));

test('A new food expense changes budget and summary but not other categories', () => {
  const more = [...tx, { kind: 'expense', amount: 2000, category_id: '2', transaction_date: '2026-10-21' }];
  assert.equal(calculateMonthlySummary(more, '2026-10').net_amount, 268000);
  assert.equal(
    calculateBudgetProgress({ category_id: '2', budget_month: '2026-10-01', amount_limit: 40000 }, more)
      .remaining_amount,
    13000
  );
});

test('Goal contribution progress is independent of transactions', () =>
  assert.deepEqual(
    calculateGoalProgress({ target_amount: 100000, saved_amount: 65000, monthly_plan: 5000 }),
    {
      saved_amount: 65000,
      remaining_amount: 35000,
      progress_percent: 65,
      bar_percent: 65,
      monthly_plan: 5000,
      completed: false,
    }
  ));

test('Overspent budget remains negative and bar caps at 100', () => {
  const result = calculateBudgetProgress(
    { category_id: '2', budget_month: '2026-10-01', amount_limit: 20000 },
    tx
  );
  assert.equal(result.remaining_amount, -5000);
  assert.equal(result.bar_percent, 100);
  assert.equal(result.over_budget, true);
});

test('Invalid financial inputs fail instead of silently rounding', () => {
  assert.throws(() =>
    calculateMonthlySummary([{ kind: 'expense', amount: 9.5, transaction_date: '2026-10-01' }], '2026-10')
  );
  assert.throws(() => monthBounds('2026-13'));
});

// --- Constitution Parts B–J & M tests ---

test('B1–B3 & B6: Asset and liability balances compute from opening + records', () => {
  const accounts = [
    { id: 'bank', kind: 'bank', manual_balance: 100000 },
    { id: 'cash', kind: 'cash', manual_balance: 10000 },
    { id: 'digital', kind: 'digital', manual_balance: 5000 },
    { id: 'card', kind: 'credit_card', manual_balance: 20000 },
    { id: 'paidy', kind: 'bnpl', manual_balance: 0 },
  ];
  const records = [
    { kind: 'income', amount: 150000, account_id: 'bank', transaction_date: '2026-11-01' },
    { kind: 'expense', amount: 3000, account_id: 'cash', transaction_date: '2026-11-02' },
    { kind: 'expense', amount: 12000, account_id: 'card', transaction_date: '2026-11-03' },
    { kind: 'expense', amount: 4000, account_id: 'paidy', transaction_date: '2026-11-04' },
  ];
  assert.equal(getAccountBalance(accounts[0], records), 250000);
  assert.equal(getAccountBalance(accounts[1], records), 7000);
  assert.equal(getAccountBalance(accounts[2], records), 5000);
  assert.equal(getAccountBalance(accounts[3], records), 32000);
  assert.equal(getAccountBalance(accounts[4], records), 4000);
});

test('B4: Debit card is a tag on its bank account and never double-counts', () => {
  const accounts = [
    { id: 'bank-1', kind: 'bank', manual_balance: 80000, ui_details: { has_debit_card: true } },
    { id: 'debit-tag', kind: 'debit_card', parent_bank_account_id: 'bank-1', manual_balance: 80000 },
  ];
  const debitAccId = resolvePaymentAccountId({ payment_method: 'debit' }, accounts);
  assert.equal(debitAccId, 'bank-1');
  const records = [
    { kind: 'expense', amount: 5000, account_id: debitAccId, transaction_date: '2026-11-05' },
  ];
  const totals = getAccountTotals(accounts, records);
  assert.equal(totals.held, 75000);
  assert.equal(totals.net, 75000);
});

test('B5: Credit limit is never counted as an asset or spendable money', () => {
  const accounts = [
    { id: 'cash', kind: 'cash', manual_balance: 20000 },
    {
      id: 'card',
      kind: 'credit_card',
      manual_balance: 5000,
      credit_limit: 500000,
      ui_details: { credit_limit: 500000 },
    },
  ];
  const totals = getAccountTotals(accounts, []);
  assert.equal(totals.held, 20000);
  assert.equal(totals.spendable, 20000);
  assert.equal(totals.owed, 5000);
  assert.equal(totals.net, 15000);
});

test('C3: Transfer between own accounts (e.g. ATM withdrawal) is never income or expense', () => {
  const accounts = [
    { id: 'bank', kind: 'bank', manual_balance: 100000 },
    { id: 'cash', kind: 'cash', manual_balance: 5000 },
  ];
  const records = [
    {
      kind: 'transfer',
      amount: 30000,
      account_id: 'bank',
      to_account_id: 'cash',
      transaction_date: '2026-11-05',
    },
  ];
  const summary = calculateMonthlySummary(records, '2026-11');
  assert.equal(summary.income_amount, 0);
  assert.equal(summary.expense_amount, 0);
  assert.equal(summary.net_amount, 0);
  assert.equal(getAccountBalance(accounts[0], records), 70000);
  assert.equal(getAccountBalance(accounts[1], records), 35000);
  assert.equal(getAccountTotals(accounts, records).net, 105000);
});

test('C4: Card/BNPL payment is a transfer (asset -> liability), never a second expense', () => {
  const accounts = [
    { id: 'bank', kind: 'bank', manual_balance: 100000 },
    { id: 'card', kind: 'credit_card', manual_balance: 0 },
  ];
  const records = [
    // Purchase on card counts as expense on purchase day (C2)
    { kind: 'expense', amount: 15000, account_id: 'card', category_id: 'food', transaction_date: '2026-11-02' },
    // Paying the card bill later is a transfer, NOT a second expense (C4)
    {
      kind: 'card_payment',
      amount: 15000,
      account_id: 'bank',
      to_account_id: 'card',
      transaction_date: '2026-11-27',
    },
  ];
  const summary = calculateMonthlySummary(records, '2026-11');
  assert.equal(summary.expense_amount, 15000);
  assert.equal(summary.income_amount, 0);
  assert.equal(getAccountBalance(accounts[0], records), 85000);
  assert.equal(getAccountBalance(accounts[1], records), 0);
  assert.equal(getAccountTotals(accounts, records).net, 85000);
});

test('C6: Quick Add defaults to Expense from Cash on today and counts in category reports', () => {
  const accounts = [
    { id: 'bank', kind: 'bank', manual_balance: 50000 },
    { id: 'cash', kind: 'cash', manual_balance: 10000 },
  ];
  const quickTx = buildQuickAddTransaction(
    { amount: 850, category_id: 'food', category_name: 'Food & Dining' },
    accounts,
    '2026-11-13'
  );
  assert.equal(quickTx.kind, 'expense');
  assert.equal(quickTx.account_id, 'cash');
  assert.equal(quickTx.transaction_date, '2026-11-13');
  assert.equal(getAccountBalance(accounts[1], [quickTx]), 9150);
  assert.equal(getAccountBalance(accounts[0], [quickTx]), 50000);
  const breakdown = getCategoryBreakdown([quickTx], '2026-11', [{ id: 'food', name: 'Food & Dining' }]);
  assert.equal(breakdown.totalExpense, 850);
});

test('C8: Future-dated records change no balance today but reduce safe-to-spend in current month', () => {
  const accounts = [{ id: 'cash', kind: 'cash', manual_balance: 50000 }];
  const records = [
    { kind: 'expense', amount: 10000, account_id: 'cash', transaction_date: '2026-11-25' },
  ];
  assert.equal(getAccountBalance(accounts[0], records, '2026-11-13'), 50000);
  assert.equal(getAccountBalance(accounts[0], records, '2026-11-25'), 40000);

  const safe = getSafeToSpend({
    accounts,
    transactions: records,
    bills: [],
    goals: [],
    today: '2026-11-13',
  });
  assert.equal(safe.spendable, 50000);
  assert.equal(safe.futureExpensesThisMonth, 10000);
  assert.equal(safe.availablePool, 40000);
});

test('D1–D3 & J4: Net worth can be negative and period change reconciles with income - expenses ± adjustments', () => {
  const negAccounts = [
    { id: 'cash', kind: 'cash', manual_balance: 10000 },
    { id: 'loan', kind: 'loan', manual_balance: 45000 },
  ];
  assert.equal(getAccountTotals(negAccounts, []).net, -35000);

  const accounts = [
    { id: 'bank', kind: 'bank', manual_balance: 100000 },
    { id: 'cash', kind: 'cash', manual_balance: 10000 },
    { id: 'card', kind: 'credit_card', manual_balance: 20000 },
  ];
  const records = [
    { kind: 'income', amount: 200000, account_id: 'bank', transaction_date: '2026-11-05' },
    { kind: 'expense', amount: 40000, account_id: 'card', category_id: 'shop', transaction_date: '2026-11-10' },
    { kind: 'transfer', amount: 25000, account_id: 'bank', to_account_id: 'cash', transaction_date: '2026-11-12' },
    { kind: 'card_payment', amount: 30000, account_id: 'bank', to_account_id: 'card', transaction_date: '2026-11-20' },
    { kind: 'adjustment', amount: 1500, account_id: 'cash', direction: 'decrease', transaction_date: '2026-11-25' },
  ];
  const rec = reconcilePeriodNetWorth(accounts, records, '2026-11');
  assert.equal(rec.reconciled, true);
  assert.equal(rec.expected_flow, 200000 - 40000 - 1500);
  assert.equal(rec.net_worth_change, 158500);
});

test('E4: Budget pace line calculates expected spend by today and flags over-pace categories', () => {
  const budget = { category_id: 'food', category_name: 'Food', budget_month: '2026-11', amount_limit: 30000 };
  // On 2026-11-10 (10 of 30 days passed), expected spend = 10,000
  const fastTx = [{ kind: 'expense', amount: 14000, category_id: 'food', transaction_date: '2026-11-08' }];
  const fastStatus = getBudgetStatus(budget, fastTx, '2026-11-10');
  assert.equal(fastStatus.expected_spend, 10000);
  assert.equal(fastStatus.over_pace, true);
  assert.equal(fastStatus.pace_label, 'A bit fast this month');

  const okTx = [{ kind: 'expense', amount: 8000, category_id: 'food', transaction_date: '2026-11-08' }];
  const okPace = calculateBudgetPace(budget, okTx, '2026-11-10');
  assert.equal(okPace.over_pace, false);
  assert.equal(okPace.pace_label, 'On track');
});

test('F1, M2, M3: Refund, reimbursement, and cashback offset their expense category and are never income', () => {
  const accounts = [
    { id: 'bank', kind: 'bank', manual_balance: 50000 },
    { id: 'card', kind: 'credit_card', manual_balance: 0 },
  ];
  const records = [
    { kind: 'expense', amount: 12000, category_id: 'dining', account_id: 'bank', transaction_date: '2026-11-05' },
    { kind: 'reimbursement', amount: 6000, category_id: 'dining', account_id: 'bank', transaction_date: '2026-11-06' },
    { kind: 'expense', amount: 10000, category_id: 'shop', account_id: 'card', transaction_date: '2026-11-07' },
    { kind: 'refund', amount: 3000, category_id: 'shop', account_id: 'card', transaction_date: '2026-11-08' },
    { kind: 'cashback', amount: 500, category_id: 'shop', account_id: 'card', transaction_date: '2026-11-09' },
  ];

  const summary = calculateMonthlySummary(records, '2026-11');
  assert.equal(summary.income_amount, 0);
  assert.equal(summary.expense_amount, (12000 - 6000) + (10000 - 3000 - 500));

  const diningBudget = calculateBudgetProgress(
    { category_id: 'dining', budget_month: '2026-11-01', amount_limit: 20000 },
    records
  );
  assert.equal(diningBudget.spent_amount, 6000);

  assert.equal(getAccountBalance(accounts[0], records), 50000 - 12000 + 6000);
  assert.equal(getAccountBalance(accounts[1], records), 10000 - 3000 - 500);
});

test('F2, F3, F5, F6: Interest/fees, friend loan asset, and record deletion recalculation', () => {
  const accounts = [
    { id: 'bank', kind: 'bank', manual_balance: 100000 },
    { id: 'card', kind: 'credit_card', manual_balance: 20000 },
    { id: 'friend', kind: 'cash', manual_balance: 10000, ui_details: { group: 'loan_asset' } },
  ];
  const records = [
    // F2: Card interest/fee is an expense that raises card liability
    { id: 1, kind: 'expense', amount: 800, account_id: 'card', category_id: 'fees', transaction_date: '2026-11-10' },
    // F3: Bank interest earned is income
    { id: 2, kind: 'income', amount: 120, account_id: 'bank', category_id: 'interest', transaction_date: '2026-11-11' },
    // F5: Friend repays half via transfer, half forgiven via adjustment
    { id: 3, kind: 'transfer', amount: 5000, account_id: 'friend', to_account_id: 'bank', transaction_date: '2026-11-12' },
    { id: 4, kind: 'adjustment', amount: 5000, account_id: 'friend', direction: 'decrease', transaction_date: '2026-11-13' },
  ];
  assert.equal(getAccountBalance(accounts[1], records), 20800);
  assert.equal(getAccountBalance(accounts[0], records), 105120);
  assert.equal(getAccountBalance(accounts[2], records), 0);

  // F6: Deleting record #1 removes its effect everywhere at once
  const afterDelete = records.filter((r) => r.id !== 1);
  assert.equal(getAccountBalance(accounts[1], afterDelete), 20000);
  assert.equal(getMonthlySummary(afterDelete, '2026-11').expense, 0);
});

test('G1–G5: Spendable, safe-to-spend (negative stays negative), and ranked engine alerts', () => {
  const accounts = [
    { id: 'cash', kind: 'cash', manual_balance: 10000 },
    { id: 'bank', kind: 'bank', manual_balance: 20000 },
    { id: 'savings', kind: 'savings', manual_balance: 500000 }, // excluded from spendable (G2)
    { id: 'card', kind: 'credit_card', manual_balance: 15000 },
  ];
  const bills = [
    { id: 'b1', name: 'Rent', amount: 45000, due_date: '2026-11-10', is_paid: false }, // overdue
  ];
  const goals = [
    { id: 'g1', title: 'Trip', target_amount: 100000, saved_amount: 20000, monthly_plan: 10000 },
  ];
  const safe = getSafeToSpend({
    accounts,
    transactions: [],
    bills,
    goals,
    buffer: 5000,
    today: '2026-11-13',
  });
  // G2: spendable = 10,000 + 20,000 = 30,000 (savings & card excluded)
  assert.equal(safe.spendable, 30000);
  // G3: 30,000 - 45,000 (bills) - 10,000 (goals) - 5,000 (buffer) = -30,000 (stays negative!)
  assert.equal(safe.availablePool, -30000);
  assert.equal(safe.overPlan, true);
  assert.ok(safe.dailySafe < 0);

  const budgets = [
    { id: 'bud1', category_id: 'food', category_name: 'Groceries', budget_month: '2026-11', amount_limit: 10000 },
  ];
  const txs = [
    { kind: 'expense', amount: 8500, category_id: 'food', transaction_date: '2026-11-05' }, // 15% left <= 20% threshold
  ];
  const alerts = getEngineAlerts({
    budgets,
    transactions: txs,
    bills,
    goals,
    safeToSpend: safe,
    settings: { budget_warning_percent: 20, bill_reminder_days: 3 },
    today: '2026-11-13',
  });
  assert.equal(alerts[0].kind, 'overdue_bill');
  assert.equal(alerts[1].kind, 'safe_to_spend_negative');
  assert.equal(alerts[2].kind, 'budget_threshold');
  assert.match(alerts[2].title, /Groceries: only 15% of the budget is left/);
});

test('H3 & H5: Goal ¥0-target guard returns null percentage ("Set a target"), zero pace returns "no date yet"', () => {
  const zeroGoal = calculateGoalProgress({ target_amount: 0, saved_amount: 0, monthly_plan: 0 });
  assert.equal(zeroGoal.progress_percent, null);
  assert.equal(zeroGoal.label, 'Set a target');
  assert.equal(zeroGoal.completed, false);

  const zeroForecast = getGoalForecast({ target_amount: 0, saved_amount: 0 }, 10000, '2026-11-13');
  assert.equal(zeroForecast.expectedDate, null);
  assert.equal(zeroForecast.label, 'Set a target');

  const noPaceForecast = getGoalForecast(
    { target_amount: 100000, saved_amount: 20000, monthly_plan: 0 },
    0,
    '2026-11-13'
  );
  assert.equal(noPaceForecast.expectedDate, null);
  assert.equal(noPaceForecast.label, 'no date yet');
});

test('Part I: Health score uses 30/30/20/20 weights (15 for no budgets, 20 for no debt) and names weakestPart', () => {
  const scoreNoBudgetsNoDebt = getHealthScore({
    monthIncome: 200000,
    monthExpense: 150000, // 25% savings rate -> 30 pts
    monthlyBudgets: [], // no budgets set -> 15 pts
    bills: [], // no bills due -> 20 pts
    totalAssets: 100000,
    totalLiabilities: 0, // no debt -> 20 pts
    today: '2026-11-13',
  });
  assert.equal(scoreNoBudgetsNoDebt.savingsPts, 30);
  assert.equal(scoreNoBudgetsNoDebt.budgetPts, 15);
  assert.equal(scoreNoBudgetsNoDebt.debtPts, 20);
  assert.equal(scoreNoBudgetsNoDebt.billPts, 20);
  assert.equal(scoreNoBudgetsNoDebt.score, 85);
  assert.equal(scoreNoBudgetsNoDebt.weakestPart, 'budgets');
});

test('J2 & M1: Account view filters linked records only, and salary gross/deductions count once as net', () => {
  const netSalary = normalizeSalaryAmount({ gross_amount: 280000, deductions: 45000 });
  assert.equal(netSalary, 235000);

  const records = [
    { id: 1, kind: 'income', amount: netSalary, account_id: 'bank', transaction_date: '2026-11-25' },
    { id: 2, kind: 'expense', amount: 1200, account_id: 'cash', transaction_date: '2026-11-26' },
    { id: 3, kind: 'transfer', amount: 10000, account_id: 'bank', to_account_id: 'cash', transaction_date: '2026-11-27' },
  ];
  const bankOnly = getAccountTransactions('bank', records);
  assert.deepEqual(bankOnly.map((r) => r.id), [1, 3]);
  assert.equal(getMonthlySavingPace(records), 235000 - 1200);
});
