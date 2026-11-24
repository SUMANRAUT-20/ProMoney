import { isValidISODate, parseWholeYen } from '../../utils/formatters.js';
import { accountGroups, actionEntities, actionFields } from './chatActionFields.js';

const key = (value) => String(value ?? '').normalize('NFKC').trim().toLowerCase();
const recordName = (entity, record) => record[actionEntities[entity].name] || record.title || '';

function matchOne(records, name, label) {
  if (!key(name)) return null;
  const matches = records.filter((record) =>
    key(label(record)) === key(name) || '#' + String(record.id) === key(name));
  return matches.length === 1 ? matches[0] : null;
}

function existingValues(record, finance) {
  if (!record) return {};
  const category = finance.categories.find((item) => String(item.id) === String(record.category_id));
  const account = finance.accounts.find((item) => String(item.id) === String(record.account_id));
  return { ...record, category: category?.name || record.category, account: account?.name };
}

export function makeChatProposal(action, finance) {
  const spec = action && Object.hasOwn(actionEntities, action.entity) && actionEntities[action.entity];
  if (!spec) return { question: 'What record would you like to add, change, or delete?' };
  const { entity, operation, target, values } = action;
  const specialEdit = entity === 'budget' || Boolean(spec.edit);
  if (!['create', 'edit', 'delete'].includes(operation) || (operation === 'edit' && !specialEdit)
    || (operation === 'delete' && !spec.remove)) return { question: `What change should I propose for the ${spec.label}?` };

  let records = finance[spec.list] || [];
  if (entity === 'budget' && values.budget_month) records = records.filter(({ budget_month }) => budget_month === values.budget_month);
  const record = operation === 'create' ? null : matchOne(records, target, (item) => recordName(entity, item));
  if (operation !== 'create' && !record) return { question: `Which ${spec.label} should I ${operation}? Give its exact name or #ID.` };
  const changes = entity === 'budget' ? values.amount_limit !== undefined : Object.keys(values).length > 0;
  if (operation === 'edit' && !changes) {
    return { question: `What should I change on the ${spec.label}?` };
  }

  const defaults = entity === 'goal' ? { saved_amount: 0, monthly_plan: 0 } : entity === 'bill' ? { frequency: 'monthly' } : {};
  const proposal = { entity, operation, record, draft: { ...defaults, ...existingValues(record, finance), ...values } };
  if (operation === 'delete') return { proposal: { ...proposal, draft: existingValues(record, finance) } };
  const checked = validateChatAction(proposal, proposal.draft, finance);
  return checked.question ? checked : { proposal: { ...proposal, draft: checked.values } };
}

function normalizedField(field, value) {
  if (value === undefined || value === null || !String(value).trim()) {
    return field.optional ? '' : null;
  }
  if (field.type === 'select') return field.options.find((option) => key(option.value) === key(value))?.value ?? null;
  if (field.type === 'date') return isValidISODate(value) ? value : null;
  if (field.type === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
  if (field.type === 'yen') return parseWholeYen(value, { allowZero: field.zero });
  const clean = String(value).trim();
  return clean.length <= field.limit ? clean : null;
}

function validateChatAction(proposal, draft, finance) {
  const { entity, operation, record } = proposal;
  const values = {};
  const full = entity === 'budget' && record ? { ...draft, category: record.category_name, budget_month: record.budget_month } : draft;
  for (const field of actionFields(entity, full, finance)) {
    const value = normalizedField(field, full[field.key]);
    if (value === null) return { question: `What should I use for ${field.label.toLowerCase()}?` };
    values[field.key] = value;
  }
  if (entity === 'goal' && values.saved_amount > values.target_amount) {
    return { question: 'How much is already saved? It must be at or below the target.' };
  }
  const categoryKind = entity === 'transaction' ? values.kind : 'expense';
  const category = matchOne(finance.categories.filter((c) => c.kind === categoryKind), values.category, (c) => c.name);
  const account = matchOne(finance.accounts, values.account || values.parent_account, (a) => a.name);
  if (values.category && !category) return { question: 'Which category should I use? Give its exact name.' };
  if ((values.account || values.parent_account) && !account) {
    return { question: 'Which account should I use? Give its exact name.' };
  }
  if (entity === 'budget' && operation === 'create' && finance.budgets.some((budget) =>
    String(budget.category_id) === String(category.id) && budget.budget_month === values.budget_month)) {
    return { question: 'That category already has a budget for this month. Would you like to edit it?' };
  }
  if (entity === 'category' && finance.categories.some((item) => key(item.name) === key(values.name))) {
    return { question: 'That category name already exists. What new name should I use?' };
  }
  return { values, category, account };
}

export function chatActionLabel(proposal, draft = proposal.draft) {
  return draft.name || draft.title || draft.note || draft.category || proposal.record?.category_name || actionEntities[proposal.entity].label;
}

function buildPayload(entity, { values, account, category }) {
  if (entity === 'account') {
    const { name, kind, manual_balance, provider, note } = values;
    return { name, kind, manual_balance: manual_balance ?? 0, parent_account_id: account?.id ?? null,
      ui_details: { group: accountGroups[kind], provider: provider || account?.name || '', note } };
  }
  if (entity === 'transaction') {
    const { category: categoryName, account: _account, ...details } = values;
    return { ...details, title: details.note, category_id: category.id, category_name: categoryName, account_id: account?.id ?? null };
  }
  if (entity === 'budget') {
    return { category_id: category.id, category_name: category.name, budget_month: values.budget_month, amount_limit: values.amount_limit };
  }
  if (entity === 'goal') return { ...values, target_date: values.target_date || null };
  return values;
}

export async function confirmChatAction(proposal, draft, finance, createCategory, step) {
  if (step === 'cancelled') return { saved: false };
  const spec = actionEntities[proposal.entity];
  const { operation, record } = proposal;
  if (operation === 'delete') {
    if (step !== 'delete-confirmed') return { needsDeleteConfirmation: true };
    await finance[spec.remove](record.id);
    return { saved: true };
  }
  if (step !== 'confirmed') return { saved: false };
  const checked = validateChatAction(proposal, draft, finance);
  if (checked.question) return checked;
  const payload = buildPayload(proposal.entity, checked);
  if (proposal.entity === 'category') await createCategory(payload);
  else if (proposal.entity === 'budget') await finance.saveBudget(record ? payload : { ...payload, create_only: true }, record?.id);
  else if (proposal.entity === 'account') await finance.addAccount(payload, payload.ui_details);
  else if (operation === 'create') await finance[spec.create](payload);
  else await finance[spec.edit](record.id, payload);
  return { saved: true };
}
