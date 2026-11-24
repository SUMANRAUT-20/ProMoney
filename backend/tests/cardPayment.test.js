import assert from 'node:assert/strict';
import test from 'node:test';
import { transactionsController } from '../src/controllers/transactionsController.js';
import { AccountModel } from '../src/models/accountModel.js';
import { TransactionModel } from '../src/models/transactionModel.js';
import * as backendMath from '../src/services/financeMath.js';
import * as frontendMath from '../../frontend/src/utils/financeMath.js';

const today = '2026-11-24';
const bank = { id: 1, kind: 'bank', manual_balance: 100000 };
const card = { id: 2, kind: 'credit_card', manual_balance: 10000 };
const accounts = [bank, card, { id: 3, kind: 'bank', manual_balance: 0 }];
const purchase = { kind: 'expense', account_id: card.id, amount: 5000, transaction_date: today };
const payment = {
  kind: 'card_payment', account_id: bank.id, to_account_id: card.id, amount: 5000,
  transaction_date: today, note: 'Pay card',
};

function callTransaction(method, body) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(result) { return result; },
  };
  return transactionsController[method]({ user: { id: 1 }, params: { id: 7 }, body }, res, assert.fail)
    .then((result) => ({ ...result, statusCode: res.statusCode }));
}

test('Saved card payment lowers the bank and card balances without adding to expenses', async (t) => {
  t.mock.method(AccountModel, 'findByIdAndUser', (id) => accounts.find((account) => account.id === id));
  const create = t.mock.method(TransactionModel, 'create', (record) => ({
    ...payment, account_id: record.accountId, to_account_id: record.toAccountId,
    category_id: record.categoryId, kind: record.kind, amount: record.amount,
  }));
  const { statusCode, data } = await callTransaction('create', { ...payment, category_id: 99 });
  assert.equal(statusCode, 201);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(data.kind, 'card_payment');
  assert.equal(data.category_id, null);
  const transactions = [purchase, data];

  for (const math of [frontendMath, backendMath]) {
    assert.equal(math.getAccountBalance(card, [purchase], today), 15000);
    assert.equal(math.getAccountBalance(card, transactions, today), 10000);
    assert.equal(math.getAccountBalance(bank, transactions, today), 95000);
    assert.equal(math.getMonthlySummary(transactions, '2026-11').expense, 5000);
    const { moneyYouHold } = math.buildHomeSummary({ accounts, transactions, today });
    assert.equal(moneyYouHold.toPayBack, 10000);
    assert.equal(moneyYouHold.spendable, 95000);
  }
});

test('Overpayment leaves zero card liability and retains the excess as non-spendable card credit', () => {
  const transactions = [purchase, { ...payment, amount: 17000 }];
  for (const math of [frontendMath, backendMath]) {
    assert.equal(math.getAccountBalance(card, transactions, today), 0);
    assert.equal(math.getAccountBalance(bank, transactions, today), 83000);
    const { moneyYouHold } = math.buildHomeSummary({ accounts, transactions, today });
    assert.equal(moneyYouHold.toPayBack, 0);
    assert.equal(moneyYouHold.spendable, 83000);
    assert.equal(moneyYouHold.realMoney, 85000);
    assert.equal(moneyYouHold.accountBreakdown.find((account) => account.id === card.id).cardCredit, 2000);
  }
});

test('Card payment endpoints require an asset source and a credit card or BNPL destination', async (t) => {
  t.mock.method(AccountModel, 'findByIdAndUser', (id) => accounts.find((account) => account.id === id));
  t.mock.method(TransactionModel, 'findByIdAndUser', () => payment);
  const create = t.mock.method(TransactionModel, 'create');
  const update = t.mock.method(TransactionModel, 'update');

  assert.equal((await callTransaction('create', { ...payment, account_id: card.id })).statusCode, 400);
  assert.equal((await callTransaction('update', { to_account_id: 3 })).statusCode, 400);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
});
