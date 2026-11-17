export async function saveSelectedStatementRows(rows, addTransaction, accountId) {
  const savedIds = [];
  const savedRows = new Set();
  const selected = rows.filter((row) => row.selected === true);

  try {
    for (const row of selected) {
      const saved = await addTransaction({
        transaction_date: row.transaction_date,
        note: row.note,
        kind: row.kind,
        amount: row.amount,
        category_id: row.category_id || null,
        account_id: accountId,
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
