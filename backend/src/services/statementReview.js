import { memoryCategory } from './nidhiMemory.js';

const HEALTH_KEYWORDS = /\b(?:hospital|medical|pharmacy|clinic)\b|病院|薬局|医療/;

const CATEGORY_RULES = [
  [/\b(?:salary|payroll|wages)\b|給与|給料/, /^(?:salary|part time salary|給与|給料)$/],
  [/\b(?:freelance|contract work)\b|業務委託/, /^(?:freelance|フリーランス)$/],
  [/\b(?:rent|mortgage)\b|家賃/, /^(?:housing|rent|住宅|家賃)$/],
  [/\b(?:grocery|groceries|supermarket|aeon|aldi|costco)\b|スーパー|生協/, /^(?:groceries|grocery|食料品|食費)$/],
  [/\b(?:coffee|cafe|restaurant|lunch|dinner|starbucks|family ?mart|lawson|7 eleven)\b|カフェ|食堂|飲食|ファミリーマート|ローソン|セブンイレブン/, /^(?:food(?: and)? dining|food|飲食|外食|食費)$/],
  [/\b(?:train|railway|metro|bus|taxi|suica|pasmo)\b|電車|バス|タクシー|交通/, /^(?:transport(?:ation)?|交通費|交通)$/],
  [/\b(?:electric|electricity|power|water|gas bill|utilities)\b|電気|水道|ガス/, /^(?:utilities|utility|光熱費|水道光熱費)$/],
  [/\b(?:phone|mobile|internet|broadband)\b|携帯|通信料/, /^(?:phone internet|phone and internet|通信費)$/],
  [/\b(?:tuition|school)\b|授業料|学費/, /^(?:education|学費|教育費)$/],
  [HEALTH_KEYWORDS, /^(?:healthcare|health care|医療費)$/],
  [/\b(?:cinema|theatre|theater|netflix|spotify)\b|映画/, /^(?:entertainment|娯楽)$/],
  [/\b(?:amazon|shopping|rakuten)\b|楽天市場/, /^(?:shopping|買い物)$/],
];

function titleKey(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
}

function similarTitle(first, second) {
  if (!first || !second) return false;
  if (first.replaceAll(' ', '') === second.replaceAll(' ', '')) return true;
  const [shorter, longer] = first.length < second.length ? [first, second] : [second, first];
  if (shorter.length < 4) return false;
  return (' ' + longer + ' ').includes(' ' + shorter + ' ') ||
    (/[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]/u.test(shorter) && longer.startsWith(shorter));
}

function suggestCategory(row, categories) {
  const title = titleKey(row.note);
  const choices = categories.filter((category) => category.kind === row.kind);
  const fileCategory = titleKey(row.categoryLabel);
  if (row.kind === 'expense' && (fileCategory === 'healthcare' || HEALTH_KEYWORDS.test(title))) {
    const health = choices.find((category) => titleKey(category.name) === 'health');
    if (health) return health;
  }
  const explicit = fileCategory && choices.find((category) => titleKey(category.name) === fileCategory);
  if (explicit) return explicit;
  const named = choices.find((category) => {
    const label = titleKey(category.name);
    return label.length >= 3 && (' ' + title + ' ').includes(' ' + label + ' ');
  });
  if (named) return named;
  for (const [keyword, categoryPattern] of CATEGORY_RULES) {
    if (!keyword.test(title)) continue;
    const match = choices.find((category) => categoryPattern.test(titleKey(category.name)));
    if (match) return match;
  }
  return choices.find((category) => /^(?:other(?: income| expense)?|その他(?:収入|支出)?)$/.test(titleKey(category.name)));
}

function duplicateKey(row) {
  return row.transaction_date + ':' + Number(row.amount);
}

export function buildStatementReview(rows, categories, existingTransactions, merchantMap) {
  const existingTitles = new Map();
  for (const tx of existingTransactions) {
    const key = duplicateKey(tx);
    const titles = existingTitles.get(key) ?? [];
    titles.push(titleKey(tx.title), titleKey(tx.note));
    existingTitles.set(key, titles);
  }
  return rows.map((row, index) => {
    const title = titleKey(row.note);
    const matches = existingTitles.get(duplicateKey(row)) ?? [];
    const possibleDuplicate = matches.some((existing) => similarTitle(title, existing));
    const remembered = memoryCategory(row.note, row.kind, categories, merchantMap);
    const category = remembered || suggestCategory(row, categories);
    return {
      ...row,
      id: 'statement-row-' + (index + 1),
      category_id: category?.id ?? null,
      category_name: category?.name ?? null,
      ...(remembered && { rememberedCategory: true }),
      possibleDuplicate,
      selected: !possibleDuplicate && !row.uncertain,
    };
  });
}
