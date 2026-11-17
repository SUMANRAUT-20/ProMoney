import { addMonthsISO, getCategoryBreakdown, getMonthlySummary, tokyoTodayISO } from './financeMath.js';

export function buildFinanceReport({ kind, months, transactions, categories }) {
  if (kind === 'categories') {
    const month = months[0];
    const { items, totalExpense } = getCategoryBreakdown(transactions, month, categories);
    return {
      title: 'Spending by category',
      period: month,
      columns: ['Category', 'Spending (JPY)'],
      rows: [...items.map((item) => [item.name, item.amount]), ['Total', totalExpense]],
      hasData: items.length > 0,
    };
  }
  const summaries = months.map((month) => getMonthlySummary(transactions, month));
  return {
    title: months.length > 1 ? 'Monthly comparison' : 'Income vs expenses',
    period: months.join(' to '),
    columns: ['Month', 'Income (JPY)', 'Expenses (JPY)', 'Net (JPY)'],
    rows: summaries.map(({ income, expense, net }, index) => [months[index], income, expense, net]),
    hasData: summaries.some(({ count }) => count > 0),
  };
}

export function reportRequest(question, today = tokyoTodayISO()) {
  const text = question.normalize('NFKC').toLowerCase();
  const categories = /\b(?:by category|category breakdown|category spending)\b|カテゴリ別/.test(text);
  const compare = /last month.*this month|this month.*last month|monthly comparison|先月.*今月|今月.*先月/.test(text);
  const cashFlow = /\bincome\b.*\bexpenses?\b|\bexpenses?\b.*\bincome\b|収入.*支出/.test(text);
  const report = /^report\b|\b(?:a|my|monthly|spending|expense|income|financial) report\b|レポート/.test(text);
  if (!categories && !compare && !cashFlow && !report) return null;

  const current = today.slice(0, 7);
  const previous = addMonthsISO(today, -1).slice(0, 7);
  const explicitMonths = [...new Set(text.match(/\b\d{4}-(?:0[1-9]|1[0-2])\b/g) || [])];
  if (explicitMonths.length > 2 || /\b(?:weeks?|days?|today|yesterday|quarters?|years?|annually|weekly|daily|all time)\b/.test(text)
    || /\b(?:past|last|first|next)\s+(?:\d+|two|three) months\b/.test(text)
    || /\b\d{4}-\d{2}-\d{2}\b|\b\d{4}-(?!0[1-9]\b|1[0-2]\b)\d{2}\b/.test(text)) return {};
  const named = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/);
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const namedMonth = named && String(monthNames.indexOf(named[1]) + 1).padStart(2, '0');
  const namedPeriod = named && `${named[2] || (namedMonth > current.slice(5) ? previousYear(current) : current.slice(0, 4))}-${namedMonth}`;
  const months = explicitMonths.length ? explicitMonths : compare ? [previous, current]
    : [namedPeriod || (/last month|先月/.test(text) ? previous : current)];
  if (categories && months.length !== 1) return {};
  return { kind: categories ? 'categories' : 'summary', months: months.sort() };
}

function previousYear(month) {
  return Number(month.slice(0, 4)) - 1;
}
