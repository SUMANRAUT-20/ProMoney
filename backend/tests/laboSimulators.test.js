import assert from 'node:assert/strict';
import test from 'node:test';
import { comparePayoff, getLiabilities } from '../src/services/financeMathLoans.js';
import { allocateSurplus, checkPurchase, projectWhatIf } from '../src/services/financeMathSimulators.js';

const today = '2026-01-01';
const goal = { id: 1, title: 'Trip', target_amount: 3000, saved_amount: 0, monthly_plan: 1000 };
const account = { id: 1, name: 'Bank', kind: 'bank', manual_balance: 3000 };
const data = {
  accounts: [account], transactions: [], goals: [goal],
  bills: [{ due_date: '2026-01-20', amount: 1000, is_paid: false }],
  preferences: { minimum_buffer: 1000 },
};

test('F9: a purchase diverting one monthly contribution delays the seeded goal by 30 days', () => {
  const purchase = checkPurchase(data, 1000, today);
  assert.equal(purchase.goalDelayDays, 30);
  assert.equal(purchase.covered, true);
  assert.equal(purchase.verdict, 'Tight');
  assert.equal(purchase.remaining, -1000);
  assert.equal(purchase.after, -33);
  assert.equal(checkPurchase(data, 1001, today).verdict, 'Would break the plan');
  assert.equal(checkPurchase({ ...data, bills: [] }, 1000, today).goalDelayDays, 0);
});

test('F11: monthly improvements advance the seeded goal and change each projected balance', () => {
  const projection = projectWhatIf({
    ...data,
    categories: [{ id: 1, kind: 'expense' }],
    transactions: [
      { account_id: 1, kind: 'income', amount: 1000, transaction_date: '2025-12-03' },
      { account_id: 1, kind: 'expense', amount: 500, transaction_date: '2025-12-12' },
    ],
  }, { moreIncome: 500, lessSpending: 500, categoryId: 1 }, today);
  assert.equal(projection.currentDate, '2026-04-01');
  assert.equal(projection.scenarioDate, '2026-03-01');
  assert.deepEqual(projection.currentTrend.map(({ balance }) => balance), [4000, 4500, 5000]);
  assert.deepEqual(projection.scenarioTrend.map(({ balance }) => balance), [5000, 6500, 8000]);
});

test('F12: avalanche and snowball pay the seeded debts in the expected order and months', () => {
  const plans = comparePayoff([
    { id: 1, name: 'High APR', balance: 12000, apr: 12, monthlyPayment: 0 },
    { id: 2, name: 'Small balance', balance: 6000, apr: 0, monthlyPayment: 0 },
  ], 6000);
  assert.deepEqual(plans.avalanche.payoffOrder, ['High APR', 'Small balance']);
  assert.deepEqual(plans.snowball.payoffOrder, ['Small balance', 'High APR']);
  assert.equal(plans.avalanche.months, 4);
  assert.equal(plans.snowball.months, 4);
  assert.equal(plans.avalanche.totalInterest, 183);
  assert.equal(plans.snowball.totalInterest, 306);
});

test('F12: liabilities exclude cash pots, prepaid cards and linked debit cards', () => {
  const accounts = [
    account,
    { id: 2, name: 'Savings', kind: 'savings', manual_balance: 4000 },
    { id: 3, name: 'Prepaid', kind: 'prepaid', manual_balance: 5000 },
    { id: 4, name: 'Debit', kind: 'debit_card', parent_account_id: 1 },
    { id: 5, name: 'Credit', kind: 'credit_card', manual_balance: 2000, ui_details: { credit_limit: 120000, apr: 10 } },
    { id: 6, name: 'Loan', kind: 'loan', manual_balance: 4000, ui_details: { monthly_payment: 500 } },
  ];
  const liabilities = getLiabilities(accounts, [
    { account_id: 1, to_account_id: 5, kind: 'card_payment', amount: 200, transaction_date: today },
  ], today);
  assert.deepEqual(liabilities.map(({ id, balance, apr, monthlyPayment }) => [id, balance, apr, monthlyPayment]), [
    [5, 1800, 10, null], [6, 4000, null, 500],
  ]);
  assert.throws(() => comparePayoff(liabilities, 1000), /APR and required monthly payment/);
});

test('F10: the surplus allocation reserves bills, buffer and amounts already assigned to goals', () => {
  const plan = allocateSurplus({
    ...data, goals: [{ ...goal, saved_amount: 500 }],
    accounts: [
      { ...account, manual_balance: 6000 },
      { id: 2, name: 'Card', kind: 'credit_card', manual_balance: 4000 },
    ],
  }, today);
  assert.equal(plan.surplus, 4000);
  assert.deepEqual(plan.proposals.map(({ kind, amount }) => [kind, amount]), [['goal', 2500], ['debt', 1000]]);
  assert.equal(plan.unallocated, 0);
});
