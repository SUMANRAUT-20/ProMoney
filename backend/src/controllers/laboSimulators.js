import { AccountModel } from '../models/accountModel.js';
import { BillModel } from '../models/billModel.js';
import { BudgetModel } from '../models/budgetModel.js';
import { CategoryModel } from '../models/categoryModel.js';
import { GoalModel } from '../models/goalModel.js';
import { SettingsModel } from '../models/settingsModel.js';
import { TransactionModel } from '../models/transactionModel.js';
import { comparePayoff, getLiabilities } from '../services/financeMathLoans.js';
import { allocateSurplus, checkPurchase, projectWhatIf } from '../services/financeMathSimulators.js';

export async function loadLaboPlan(userId) {
  const [accounts, transactions, bills, goals, preferences] = await Promise.all([
    AccountModel.findByUser(userId), TransactionModel.findByUser(userId),
    BillModel.findByUser(userId), GoalModel.findByUser(userId), SettingsModel.getPreferences(userId),
  ]);
  return { accounts, transactions, bills, goals, preferences };
}

function readPrice(question) {
  const text = question.normalize('NFKC');
  const prices = text.match(/¥\s*[\d,.]+|[\d,.]+\s*(?:\b(?:yen|jpy)\b|円)/gi);
  if (prices?.length !== 1 || /[-−]\s*(?:¥|\d)|\d\s+\d/.test(text)) return null;
  const value = prices[0].replace(/¥|yen|jpy|円/gi, '').trim().replace(/\.$/, '');
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value) ? value.replaceAll(',', '') : null;
}

export async function getSimulatorInsight(question, userId) {
  const purchase = /^(?:can|could) i (?:buy|afford)\b|^check before (?:i|you) buy\b/i.test(question);
  const allocation = /^(?:what can i do with my money|allocate my surplus|how should i allocate my surplus)[.!?\s]*$/i.test(question);
  if (!purchase && !allocation) return null;
  const price = purchase ? readPrice(question) : null;
  if (purchase && !price) return { answer: 'Tell me the item and one price in whole yen, such as “Can I buy a ¥30,000 jacket?”' };
  const data = await loadLaboPlan(userId);
  if (!data.accounts.length) return { answer: 'Add your balances on My Accounts so I can check your plan.' };
  try {
    if (purchase) return { answer: 'Let’s see how this purchase would fit your plan.', purchase: checkPurchase(data, price) };
    return { answer: 'Here’s one way to put your surplus to work.', allocation: allocateSurplus(data) };
  } catch (error) {
    if (error instanceof RangeError) return { answer: error.message };
    throw error;
  }
}

export async function whatIf(req, res, next) {
  try {
    const userId = req.user.id;
    const [data, categories] = await Promise.all([
      loadLaboPlan(userId), CategoryModel.findByUser(userId, { seedDefaults: false }),
    ]);
    if (!data.accounts.length) throw new RangeError('Add your balances on My Accounts to project your balance.');
    const scenario = projectWhatIf({ ...data, categories }, req.body ?? {});
    return res.set('Cache-Control', 'no-store').json({ status: 'ok', data: scenario });
  } catch (error) {
    if (error instanceof RangeError) return res.status(422).json({ error: error.message, status: 422 });
    return next(error);
  }
}

export async function loans(req, res, next) {
  try {
    const [accounts, transactions] = await Promise.all([
      AccountModel.findByUser(req.user.id), TransactionModel.findByUser(req.user.id),
    ]);
    const debts = getLiabilities(accounts, transactions);
    const payoff = req.method === 'POST' ? comparePayoff(debts, req.body?.monthlyBudget, req.body?.terms ?? {}) : null;
    return res.set('Cache-Control', 'no-store').json({ status: 'ok', data: { debts, payoff } });
  } catch (error) {
    if (error instanceof RangeError) return res.status(422).json({ error: error.message, status: 422 });
    return next(error);
  }
}
