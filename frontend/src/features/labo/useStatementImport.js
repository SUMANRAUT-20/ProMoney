import { useState } from 'react';
import { apiClient } from '../../services/api';
import { getStatementNet } from '../../utils/financeMath';
import { makeId, money } from '../../utils/formatters';
import { saveSelectedStatementRows, statementMemoryCorrections } from './saveSelectedStatementRows';

const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

function summarizeStatement({ rows, sheets }) {
  const summary = `${rows.length} ${rows.length === 1 ? 'transaction is' : 'transactions are'} ready to review. Choose the target account.`;
  const details = sheets?.map(({ name, found, skipped, reasons, note }) => {
    const reason = note || reasons.map(({ reason, count }) => `${count} × ${reason}`).join(', ');
    return `${name} · ${found} found, ${skipped} skipped${reason ? ` (${reason})` : ''}`;
  }) ?? [];
  return [summary, ...details].join('\n');
}

export function useStatementImport({ busy, setBusy, setError, setMessages, finance }) {
  const [rows, setRows] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const [rememberChanges, setRememberChanges] = useState(true);
  const accounts = finance.accounts || [];
  const account = accounts.find((item) => String(item.id) === accountId);

  const addMessage = (role, text, extra) => {
    setMessages((previous) => [...previous, { id: makeId('msg'), role, text, ...extra }]);
  };
  const showFailure = (message) => {
    addMessage('ai', message.split('\n')[0]);
  };

  const attach = async (files) => {
    if (busy || !files.length) return;
    if (rows.length) return showFailure('Finish or cancel the current statement review first.');
    const file = files[0];
    const format = /\.(csv|pdf|xlsx)$/i.exec(file.name)?.[1].toLowerCase();
    if (files.length !== 1 || !format) return showFailure('Choose one CSV, PDF, or XLSX statement. Older XLS files are unsupported.');
    if (file.size === 0) return showFailure('This statement file is empty.');
    if (file.size > MAX_STATEMENT_BYTES) return showFailure('Choose a statement no larger than 8 MB.');

    setBusy(true);
    setError('');
    addMessage('user', `Attached statement: ${file.name}`);
    try {
      const { data } = await apiClient.laboImport(file, format);
      if (!data?.rows?.length) throw new Error('No readable transactions were found in this statement.');
      setAccountId(null);
      setRememberChanges(true);
      setRows(data.rows.map((row) => ({
        ...row,
        suggestedCategoryId: row.category_id,
        selected: row.selected === true && !row.possibleDuplicate && !row.uncertain,
      })));
      addMessage('ai', summarizeStatement(data));
    } catch (error) {
      showFailure(error.name === 'TimeoutError' ? 'Reading this statement timed out. Please try again.'
        : error.message || 'Could not read this statement.');
    } finally {
      setBusy(false);
    }
  };

  const update = (id, patch) => {
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const save = async () => {
    const selected = rows.filter((row) => row.selected);
    if (busy || !account || !selected.length) return;
    setBusy(true);
    setError('');
    try {
      const { savedIds, remainingRows, error } = await saveSelectedStatementRows(
        rows, finance.addTransaction, String(account.id),
      );
      setRows(remainingRows);
      if (savedIds.length) {
        const net = getStatementNet(selected.slice(0, savedIds.length));
        const text = `Added ${savedIds.length} statement ${savedIds.length === 1 ? 'transaction' : 'transactions'}. Net ${money(net)}.`;
        addMessage('ai', text, { savedIds, undone: false });
      }
      if (error) showFailure(error.message || 'Could not save the remaining statement transactions.');
      if (rememberChanges && savedIds.length) {
        const merchantMap = statementMemoryCorrections(selected.slice(0, savedIds.length), finance.categories || []);
        if (Object.keys(merchantMap).length) {
          try {
            await apiClient.saveNidhiMemory({ merchantMap });
          } catch {
            addMessage('ai', 'The transactions were saved. I couldn’t remember the category changes.');
          }
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setRows([]);
    setAccountId(null);
    setError('');
    addMessage('ai', 'Statement review closed.');
  };

  return { rows, accounts, account, setAccountId, attach, update, save, cancel, rememberChanges, setRememberChanges };
}
