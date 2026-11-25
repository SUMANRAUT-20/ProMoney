import { getStatementNet } from '../../utils/financeMath.js';
import { isValidISODate, parseWholeYen } from '../../utils/formatters.js';

const rowAmount = (row) => parseWholeYen(row.amount, { max: 999_999_999_999 });

export function statementRowLabel(row) {
  const number = row.id?.match(/\d+$/)?.[0];
  const title = row.title?.trim() || row.sourceTitle || row.note || 'Untitled';
  return number ? `Row ${number} (${title})` : title;
}

export function statementRowError(row) {
  const label = statementRowLabel(row);
  if (!isValidISODate(row.transaction_date)) return `${label}: enter a valid calendar date.`;
  if (rowAmount(row) === null) return `${label}: enter a whole JPY amount greater than zero.`;
  if (!['income', 'expense'].includes(row.kind)) return `${label}: choose a transaction type.`;
  if (!(row.title ?? row.note)?.trim()) return `${label}: enter a title.`;
  return '';
}

export function statementReviewNet(rows) {
  return getStatementNet(rows.flatMap((row) => {
    const amount = rowAmount(row);
    return amount === null ? [] : [{ ...row, amount }];
  }));
}

export function applyStatementAccount(rows, accountId, confirmOverride) {
  const replacesOverride = rows.some((row) => row.account_id && String(row.account_id) !== accountId);
  if (replacesOverride && !confirmOverride()) return null;
  return rows.map((row) => ({ ...row, account_id: undefined }));
}

export async function saveSelectedStatementRows(rows, addTransaction, accountId) {
  const savedIds = [];
  const savedRows = new Set();
  const selected = rows.filter((row) => row.selected === true);
  const invalid = selected.find((row) => statementRowError(row));
  if (invalid) return { savedIds, remainingRows: rows, error: new Error(statementRowError(invalid)) };

  try {
    for (const row of selected) {
      const saved = await addTransaction({
        transaction_date: row.transaction_date,
        title: row.title ?? row.note,
        note: row.note,
        kind: row.kind,
        amount: rowAmount(row),
        category_id: row.category_id || null,
        account_id: row.account_id || (typeof accountId === 'function' ? accountId(row) : accountId),
      });
      if (saved?.id == null) throw new Error('Could not confirm the save. Check Transactions before retrying.');
      savedIds.push(saved.id);
      savedRows.add(row.id);
    }
    return { savedIds, remainingRows: selected.length ? [] : rows, error: null };
  } catch (error) {
    return {
      savedIds,
      remainingRows: rows.filter((row) => !savedRows.has(row.id)),
      error,
    };
  }
}

export function statementMemoryCorrections(savedRows, categories) {
  return Object.fromEntries(savedRows.flatMap((row) => {
    const categoryId = String(row.category_id ?? '');
    if (categoryId === String(row.suggestedCategoryId ?? '')) return [];
    const name = categoryId
      ? categories.find((category) => String(category.id) === categoryId && category.kind === row.kind)?.name
      : 'Uncategorized';
    return name ? [[row.sourceTitle ?? row.title ?? row.note, name]] : [];
  }));
}
