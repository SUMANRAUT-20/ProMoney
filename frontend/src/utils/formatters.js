/**
 * Shared JPY currency, consistent YYYY-MM-DD date, and validation helpers.
 */
export const money = (value) => {
  const num = Math.round(Number(value || 0));
  const abs = Math.abs(num).toLocaleString('ja-JP');
  return num < 0 ? `-¥${abs}` : `¥${abs}`;
};

export const goalPercent = (goal) => {
  const saved = Number(goal?.saved_amount ?? goal?.saved ?? 0);
  const target = Number(goal?.target_amount ?? goal?.target ?? 0);
  if (target <= 0) return 0;
  return Math.min(100, Math.round((saved / target) * 100));
};

export const sum = (items, key) =>
  items.reduce((total, item) => total + Number(item[key] || 0), 0);

const dateToISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const todayISO = (now = new Date()) => dateToISO(now);

export const currentMonthISO = (now = new Date()) => todayISO(now).slice(0, 7);

export const isValidISODate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return !Number.isNaN(dt.getTime()) && dateToISO(dt) === value;
};

export const formatDate = (value) => (value ? String(value).slice(0, 10) : '—');

export const formatMonth = (value) => (value ? String(value).slice(0, 7) : '—');

export const addDaysISO = (isoDate, days) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return dateToISO(dt);
};

export const addMonthsISO = (isoDate, months) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return dateToISO(target);
};

export const prevMonthISO = (monthStr, offset = -1) => {
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + offset, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

export const daysBetweenISO = (fromISO, toISO) => {
  const [y1, m1, d1] = fromISO.split('-').map(Number);
  const [y2, m2, d2] = toISO.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86400000);
};

export const parseWholeYen = (value, { allowZero = false, max = 1000000000 } = {}) => {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  if (!Number.isSafeInteger(amount) || amount > max) return null;
  if (allowZero ? amount < 0 : amount <= 0) return null;
  return amount;
};

export const makeId = (prefix = 'pm') =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const escapeCsv = (value) => {
  const raw = String(value ?? '');
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function exportTransactionsCsv(rows, getCatName, getAccName) {
  const header = 'Date,Type,Category,Account,Amount (JPY),Note';
  const lines = rows.map((tx) =>
    [tx.transaction_date, tx.kind, getCatName(tx), getAccName(tx.account_id), tx.amount, tx.note || tx.title || '']
      .map(escapeCsv)
      .join(','),
  );
  const blob = new Blob([`\uFEFF${[header, ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `promoney-transactions-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
