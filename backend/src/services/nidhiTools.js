import { cleanChatAction, chatActionFields } from './laboActions.js';
import { iso } from './financeMath.js';

const string = { type: 'string' };
const integer = { type: 'integer', minimum: 0, description: 'Whole JPY amount supplied by the user' };
const enumOf = (...values) => ({ type: 'string', enum: values });
const object = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
const tool = (name, description, parameters) => ({ type: 'function', function: { name, description, parameters } });
const fields = {
  kind: enumOf('expense', 'income'),
  frequency: enumOf('monthly', 'yearly', 'one_time'),
  amount: integer, amount_limit: integer, manual_balance: integer, target_amount: integer,
  saved_amount: integer, monthly_plan: integer,
  transaction_date: { type: 'string', description: 'YYYY-MM-DD. Use today from DATA for new transactions with no date given.' },
  target_date: { type: 'string', description: 'Optional YYYY-MM-DD' },
  due_date: { type: 'string', description: 'YYYY-MM-DD' },
  budget_month: { type: 'string', description: 'YYYY-MM' },
};
const accountKind = enumOf('bank', 'cash', 'digital', 'prepaid', 'debit_card', 'credit_card', 'loan');
const createFields = {
  transaction: ['note', 'kind', 'amount', 'category'],
  goal: ['title', 'target_amount'],
  budget: ['category', 'budget_month', 'amount_limit'],
  bill: ['name', 'amount', 'due_date', 'frequency', 'category'],
  account: ['name', 'kind'],
  category: ['name', 'kind'],
};
const actionHelp = {
  transaction: 'Preview a recorded income or expense, or edit an existing transaction. For multiple new entries use items, with a title in note, amount, kind and an existing category per row. Use an available account, or the sole account if only one is available.',
  goal: 'Preview a savings goal. For creation only title and target_amount are required. Use the name the user meant, with obvious spelling corrections. Do not ask for a target date or monthly plan unless the user wants one.',
  budget: 'Preview a category budget, with an existing expense category, a month, and a limit.',
  bill: 'Preview a bill or subscription with name, amount, due date, frequency and an existing expense category.',
  account: 'Preview an account. Use the correct kind. A debit card needs an existing parent account. A non-cash account other than a debit card needs a provider. Omit balance unless stated.',
  category: 'Preview an expense or income category with the requested name and kind.',
};

function actionTool(entity) {
  const properties = Object.fromEntries(chatActionFields[entity].map((key) =>
    [key, entity === 'account' && key === 'kind' ? accountKind : fields[key] ?? string]));
  const editable = !['account', 'category'].includes(entity);
  const extra = editable ? {
    operation: enumOf('create', 'edit'),
    target: { type: 'string', description: 'Exact existing record label for an edit' },
  } : {};
  if (entity === 'transaction') {
    extra.items = { type: 'array', maxItems: 12, items: object(properties, createFields.transaction) };
  }
  return tool('propose_' + entity, actionHelp[entity], object({ ...properties, ...extra }));
}

export const nidhiTools = [
  ...Object.keys(createFields).map(actionTool),
  tool('propose_delete', 'Preview deleting a budget, bill, or goal by its exact existing label. The user must confirm twice.', object({
    entity: enumOf('budget', 'bill', 'goal'), target: string, budget_month: fields.budget_month,
  }, ['entity', 'target'])),
  tool('get_report', 'Prepare an income vs expenses or category report card. Use a short English request naming the period and report type.', object({ request: string }, ['request'])),
  tool('make_export', 'Prepare a download card for a PDF, Excel or CSV report. Use a short English request with the requested period, sections and filters; spell out account and category names.', object({
    format: enumOf('pdf', 'xlsx', 'csv'), request: string,
  }, ['format', 'request'])),
  tool('start_import_guidance', 'Explain how to attach and review a statement file. Set legacy_xls for an old XLS workbook.', object({
    legacy_xls: { type: 'boolean' },
  })),
];

const lists = {
  transaction: ['transactions', 'note'], goal: ['goals', 'title'],
  budget: ['budgets', 'category_name'], bill: ['bills', 'name'],
};
const key = (label) => String(label ?? '').trim().normalize('NFKC').toLowerCase();
const same = (left, right) => key(left) === key(right);
const actionAnswer = 'Review the proposed change on the card before confirming.';

export function importGuidance(legacy = false) {
  return (legacy ? 'Save the old .xls file as .xlsx first. ' : '') +
    'Use Attach statement to upload the file. Choose the accounts, review the rows, and confirm what to add.';
}

export function requestedImportGuidance(question) {
  return /\b(?:upload(?:ing|ed)?|uplode|attach(?:ing|ed)?|import(?:ing)?)\b/i.test(question) &&
    /\b(?:xlsx?|statements?)\b/i.test(question)
    ? importGuidance(/\bxls\b/i.test(question)) : null;
}

function ownedTarget(action, finance) {
  if (!action.target) return false;
  const [list, label] = lists[action.entity];
  const matches = finance[list].filter((row) => (
    (same(row[label] || row.title, action.target) || '#' + row.id === action.target) &&
    (!action.values.budget_month || same(row.budget_month, action.values.budget_month))
  ));
  return matches.length === 1;
}

function validFields(action, finance) {
  const { values, entity } = action;
  if (values.kind && !(entity === 'account' ? accountKind : fields.kind).enum.includes(values.kind)) return false;
  if (values.frequency && !fields.frequency.enum.includes(values.frequency)) return false;
  try {
    for (const field of ['transaction_date', 'target_date', 'due_date']) if (values[field]) iso(values[field]);
  } catch {
    return false;
  }
  if (values.budget_month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.budget_month)) return false;
  if (['amount', 'amount_limit', 'target_amount'].some((field) => values[field] === 0)) return false;
  const kind = values.kind || (entity === 'transaction' ? null : 'expense');
  if (values.category && !finance.categories.some((row) => (!kind || row.kind === kind) && same(row.name, values.category))) return false;
  if ([values.account, values.parent_account].some((name) => name && !finance.accounts.some((row) => same(row.name, name)))) return false;
  if (values.target_amount && values.saved_amount > values.target_amount) return false;
  return true;
}

function checkedAction(entity, input, { finance, userText, today }) {
  const operation = input.operation ?? 'create';
  const action = cleanChatAction({ entity, operation, target: input.target, values: input }, userText);
  if (!action || !validFields(action, finance)) return null;
  const { values } = action;
  if (operation !== 'create') {
    return ownedTarget(action, finance) && (operation !== 'edit' || Object.keys(values).length) ? action : null;
  }
  if (createFields[entity].some((field) => values[field] === undefined)) return null;
  if (entity === 'account') {
    if (values.kind === 'debit_card' && !values.parent_account) return null;
    if (!['cash', 'debit_card'].includes(values.kind) && !values.provider) return null;
    values.manual_balance ??= 0;
  }
  if (entity === 'transaction') {
    values.transaction_date ??= today;
    if (!values.account && finance.accounts.length === 1) values.account = finance.accounts[0].name;
    if (!values.account && finance.accounts.length) return null;
  }
  return action;
}

function multipleTransactions(items, options) {
  if (!Array.isArray(items) || !items.length || items.length > 12) return null;
  const transactions = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const action = checkedAction('transaction', { ...item, operation: 'create' }, options);
    if (!action) return null;
    const { kind, amount, category, account, transaction_date, note } = action.values;
    const { finance } = options;
    const categoryId = finance.categories.find((row) => row.kind === kind && same(row.name, category)).id;
    const ownedAccount = finance.accounts.find((row) => same(row.name, account));
    transactions.push({ kind, amount, category_id: categoryId, category_name: category,
      account_id: ownedAccount?.id ?? null, account_name: ownedAccount?.name, transaction_date, note });
  }
  return { answer: 'Review the proposed transactions before saving.', transactions };
}

export function actionFromTool(name, args, options) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null;
  const deleting = name === 'propose_delete';
  const entity = deleting ? args.entity : name.replace(/^propose_/, '');
  if (!Object.hasOwn(createFields, entity) || (deleting && !['goal', 'budget', 'bill'].includes(entity))) return null;
  if (entity === 'transaction' && args.items !== undefined) return multipleTransactions(args.items, options);
  if (!deleting && args.operation === 'delete') return null;
  const input = deleting ? { operation: 'delete', target: args.target, budget_month: args.budget_month } : args;
  const action = checkedAction(entity, input, options);
  if (!action) return null;
  return { answer: actionAnswer, action };
}
