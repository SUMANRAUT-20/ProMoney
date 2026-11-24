import { isDebitCardAccount, isLiabilityAccount } from '../../utils/financeMath.js';

const field = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const choices = (values) => Object.entries(values).map(([value, label]) => ({ value, label }));
const transactionKinds = choices({ expense: 'Expense', income: 'Income' });
const accountKinds = choices({
  bank: 'Bank account', cash: 'Cash', digital: 'Payment app', prepaid: 'Prepaid card',
  debit_card: 'Debit card', credit_card: 'Credit card', loan: 'Loan',
});
const frequency = choices({ monthly: 'Monthly', yearly: 'Yearly', one_time: 'One time' });
const note = (key, limit) => field(key, 'Note', 'text', { optional: true, limit });

export const actionEntities = {
  account: { label: 'account', list: 'accounts', name: 'name', create: 'addAccount' },
  category: { label: 'category', list: 'categories', name: 'name' },
  transaction: { label: 'transaction', list: 'transactions', name: 'note', create: 'addTransaction', edit: 'editTransaction' },
  budget: { label: 'budget', list: 'budgets', name: 'category_name', remove: 'removeBudget' },
  bill: { label: 'bill', list: 'bills', name: 'name', create: 'addBill', edit: 'editBill', remove: 'removeBill' },
  goal: { label: 'savings goal', list: 'goals', name: 'title', create: 'addGoal', edit: 'editGoal', remove: 'removeGoal' },
};

export const accountGroups = {
  bank: 'bank', cash: 'cash', digital: 'app', prepaid: 'prepaid', debit_card: 'debit', credit_card: 'credit', loan: 'loan',
};

export function actionFields(entity, draft, finance) {
  const categories = (kind) => (finance.categories || []).filter((c) => c.kind === kind)
    .map(({ name }) => ({ value: name, label: name }));
  const accountChoices = (finance.accounts || []).map(({ name }) => ({ value: name, label: name }));
  const parentChoices = (finance.accounts || []).filter((account) => !isDebitCardAccount(account) && !isLiabilityAccount(account)
    && (['bank', 'digital', 'cash'].includes(account.kind) || ['bank', 'app'].includes(account.ui_details?.group)))
    .map(({ name }) => ({ value: name, label: name }));
  const category = (kind) => field('category', 'Category', 'select', { options: categories(kind) });
  const kind = (options) => field('kind', 'Type', 'select', { options });
  const name = (limit = 80) => field('name', 'Name', 'text', { limit });

  return {
    account: [
      name(), kind(accountKinds),
      ...(draft.kind === 'debit_card'
        ? [field('parent_account', 'Parent account', 'select', { options: parentChoices })]
        : [
          ...(draft.kind !== 'cash' ? [field('provider', 'Provider', 'text', { limit: 80 })] : []),
          field('manual_balance', 'Opening balance', 'yen', { zero: true }),
        ]),
      note('note', 150),
    ],
    category: [name(60), kind(transactionKinds)],
    transaction: [
      field('note', 'Note', 'text', { limit: 120 }), kind(transactionKinds),
      field('amount', 'Amount', 'yen'), field('transaction_date', 'Date', 'date'), category(draft.kind),
      field('account', 'Account', 'select', { options: accountChoices, optional: accountChoices.length === 0 }),
    ],
    budget: [category('expense'), field('budget_month', 'Budget month', 'month'), field('amount_limit', 'Monthly limit', 'yen')],
    bill: [
      name(), field('amount', 'Amount', 'yen'), field('due_date', 'Due date', 'date'),
      field('frequency', 'Frequency', 'select', { options: frequency }), category('expense'), note('notes', 200),
    ],
    goal: [
      field('title', 'Name', 'text', { limit: 80 }), field('target_amount', 'Target', 'yen'),
      field('target_date', 'Target date', 'date', { optional: true }),
      field('saved_amount', 'Already saved', 'yen', { zero: true }),
      field('monthly_plan', 'Monthly plan', 'yen', { zero: true }),
    ],
  }[entity];
}
