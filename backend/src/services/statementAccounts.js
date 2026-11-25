export function accountLabelKey(label) {
  return String(label ?? '').trim().toLowerCase();
}

function suggestedGroup(value) {
  if (/\b(?:card|credit)\b|カード/.test(value)) return 'credit';
  if (/\bbank\b|銀行/.test(value)) return 'bank';
  if (/\bcash\b|現金/.test(value)) return 'cash';
  return null;
}

export function matchStatementAccounts(rows, accounts, accountMap = {}) {
  if (!rows.some((row) => Object.hasOwn(row, 'accountLabel'))) return { rows, accountGroups: null };
  const groups = new Map();
  const assignedRows = rows.map((row) => {
    const key = accountLabelKey(row.accountLabel);
    if (!groups.has(key)) {
      const remembered = key && Object.hasOwn(accountMap, key)
        ? accounts.find((account) => String(account.id) === accountMap[key]) : null;
      const matches = key ? accounts.filter((account) => accountLabelKey(account.name) === key) : [];
      const account = remembered || (matches.length === 1 ? matches[0] : null);
      groups.set(key, {
        key, label: row.accountLabel?.trim() || '', count: 0,
        accountId: account ? String(account.id) : '',
        remembered: Boolean(remembered), suggestedGroup: suggestedGroup(key),
      });
    }
    const group = groups.get(key);
    group.count += 1;
    group.suggestedGroup ??= suggestedGroup(accountLabelKey(row.paymentMethod));
    return { ...row, accountGroup: key };
  });
  return { rows: assignedRows, accountGroups: [...groups.values()] };
}
