import { tokyoTodayISO, yen } from './financeMath.js';
import { completeLaboExtraction } from './laboChat.js';

export const chatActionFields = {
  account: ['name', 'kind', 'provider', 'parent_account', 'manual_balance', 'note'],
  category: ['name', 'kind'],
  transaction: ['note', 'kind', 'amount', 'category', 'account', 'transaction_date'],
  budget: ['category', 'budget_month', 'amount_limit'],
  bill: ['name', 'amount', 'due_date', 'frequency', 'category', 'notes'],
  goal: ['title', 'target_amount', 'saved_amount', 'monthly_plan', 'target_date'],
};
const amounts = new Set(['manual_balance', 'amount', 'amount_limit', 'target_amount', 'saved_amount', 'monthly_plan']);
const operations = { account: ['create'], category: ['create'], transaction: ['create', 'edit'] };
const instructions = [
  'Extract a single user-requested finance action. Return only JSON.',
  'Use { "entity": "account|category|transaction|budget|bill|goal", "operation": "create|edit|delete", "target": "exact existing name or note", "values": {} }.',
  'Accounts and categories support create only; transactions support create and edit; budgets, bills and goals support create, edit and delete.',
  'For edit/delete, target is the label of the record BEFORE the change. For budgets the target is its category name, with budget_month if explicitly given.',
  'Use only values explicitly supplied by the user. Use the latest clarification for corrected fields. Omit missing fields. Do not guess money, labels, categories, account names, frequency, dates or IDs. Convert explicit relative dates using TODAY when unambiguous.',
  'Use ISO YYYY-MM-DD dates and YYYY-MM budget months. JPY amounts are whole integers exactly as stated. For ambiguous requests or multiple actions return {}.',
  'Account kinds: bank, cash, digital, prepaid, debit_card, credit_card, loan. Category and transaction kinds: income or expense. Bill frequencies: monthly, yearly, one_time.',
  `Allowed fields by entity: ${JSON.stringify(chatActionFields)}`,
].join('\n');

function statedAmounts(text) {
  const withoutDates = text.normalize('NFKC').replace(/\b\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?\b/g, ' ')
    .replace(/JPY(?=\d)/gi, ' ');
  return new Set([...withoutDates.matchAll(/(?<![\p{Script=Latin}\d.,−])-?\d+(?:,\d{3})*(?:\.\d+)?(?!\d|[.,]\d|[kKmMbB万億兆])/gu)]
    .map(([value]) => Number(value.replaceAll(',', ''))));
}

export function readChatAction(answer, text) {
  let parsed;
  try {
    parsed = JSON.parse(String(answer).slice(String(answer).indexOf('{'), String(answer).lastIndexOf('}') + 1));
  } catch {
    return null;
  }
  return cleanChatAction(parsed, text);
}

export function cleanChatAction(parsed, text) {
  if (!parsed || !Object.hasOwn(chatActionFields, parsed.entity)) return null;
  const { entity, operation, target, values } = parsed;
  if (!(operations[entity] ?? ['create', 'edit', 'delete']).includes(operation)) return null;

  const stated = statedAmounts(text);
  const clean = {};
  for (const key of chatActionFields[entity]) {
    const value = values?.[key];
    if (amounts.has(key)) {
      if ((typeof value === 'number' || typeof value === 'string') && String(value).trim()
        && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && stated.has(Number(value))) clean[key] = yen(value);
    } else if (typeof value === 'string' && value.trim()) {
      clean[key] = value.trim().slice(0, 200);
    }
  }
  return { entity, operation, target: typeof target === 'string' ? target.trim().slice(0, 120) : '', values: clean };
}

export async function proposeLaboAction(text, options) {
  const answer = await completeLaboExtraction([
    { role: 'system', content: `${instructions}\nTODAY: ${tokyoTodayISO()}` },
    { role: 'user', content: text },
  ], options);
  return readChatAction(answer, text);
}
