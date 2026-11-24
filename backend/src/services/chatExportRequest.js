import { reportRequest } from './financeReport.js';

const sectionPatterns = {
  summary: /\bsummary\b/,
  categories: /\b(?:category breakdown|breakdown|by category)\b/,
  transactions: /\btransactions?\b/,
  budgets: /\bbudgets?\b/,
  goals: /\bgoals?\b/,
};
const defaultSections = ['summary', 'categories', 'transactions'];
const aliases = new Map([['food & dining', ['food', 'dining']], ['transportation', ['transport', 'transit']]]);
const normalize = (value) => String(value).normalize('NFKC').trim().toLowerCase();

export function chatExportFormat(question) {
  const text = normalize(question);
  if (!/\b(?:report|export|download|give me|send me|expenses?|income|transactions?|budgets?|goals?)\b/.test(text)
    || /\b(?:attach|upload|import)\b/.test(text)) return null;
  const format = text.match(/\b(pdf|xlsx|excel|csv)\b/)?.[1];
  return format === 'excel' ? 'xlsx' : format ?? null;
}

function sectionNames(text) {
  return Object.entries(sectionPatterns).filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function matchName(text, options, allowAliases) {
  const exact = options.find((option) => normalize(option.name) === text);
  if (exact || !allowAliases) return exact;
  return options.find((option) => aliases.get(normalize(option.name))?.includes(text));
}

function resolveFilter(phrase, options, allowAliases = false) {
  if (!phrase) return [];
  const text = normalize(phrase.replace(/^[“”"']|[“”"'!?\.]+$/g, ''));
  const exact = matchName(text, options, allowAliases);
  if (exact) return [exact.id];
  const matches = text.split(/\s*,\s*|\s+and\s+/).map((part) => matchName(part, options, allowAliases));
  return matches.every(Boolean) ? [...new Set(matches.map(({ id }) => id))] : null;
}

function clause(text, label) {
  return text.match(new RegExp(`\\b${label}\\s*[:=]\\s*(.+?)(?=;|,\\s*(?:accounts?|categor(?:y|ies)|sections?|only)\\b|$)`))?.[1];
}

export function parseChatExport(question, { format, categories, accounts, today }) {
  const text = normalize(question);
  const requestedOnly = text.match(/\bonly\s+(.+?)(?=;|,\s*(?:accounts?|categor(?:y|ies)|sections?)\s*[:=]|$)/)?.[1]?.replace(/[?.!]+$/, '');
  const sectionClause = clause(text, 'sections?') || text.match(/\b(?:include|including|with)\s+([^;]+)/)?.[1];
  const sections = sectionNames(sectionClause || (requestedOnly && /^(?:summary|category breakdown|transactions?|budgets?|(?:savings )?goals?)\b/.test(requestedOnly) ? requestedOnly : ''));
  const kind = /\bincome\b/.test(text) && !/\bexpenses?\b/.test(text) ? 'income'
    : /\bexpenses?\b/.test(text) && !/\bincome\b/.test(text) ? 'expense' : null;
  const filterOnly = requestedOnly && !sections.length && !/^(?:income|expenses?)$/.test(requestedOnly) ? requestedOnly : null;
  const accountClause = clause(text, 'accounts?') ||
    text.match(/\b(?:from|for)\s+(?:the |my )?(.+?)\s+account\b/)?.[1];
  const categoryClause = clause(text, 'categor(?:y|ies)');
  const onlyAccounts = !categoryClause && filterOnly && resolveFilter(filterOnly, accounts);
  const labeledAccounts = resolveFilter(accountClause, accounts);
  const categoryIds = resolveFilter(categoryClause || (onlyAccounts ? null : filterOnly), categories, true);
  if (!labeledAccounts) return { error: 'Which account should I include? Use its name from My Accounts.' };
  if (!categoryIds) return { error: 'Which categories should I include? Use their names from Transactions.' };

  const periodText = text.split(/\bonly\b|\b(?:accounts?|categor(?:y|ies)|sections?)\s*[:=]/)[0];
  const { months } = reportRequest(`report ${periodText}`, today) || {};
  if (!months) return { error: 'Choose a month for the download, such as last month or October 2026.' };
  const accountIds = [...new Set([...labeledAccounts, ...(onlyAccounts || [])])];
  return { format, months, categoryIds, accountIds, kind, sections: sections.length ? sections : defaultSections };
}
