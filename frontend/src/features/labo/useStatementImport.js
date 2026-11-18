import { useState } from 'react';
import { apiClient } from '../../services/api';
import { makeId } from '../../utils/formatters';
import { saveSelectedStatementRows } from './saveSelectedStatementRows';

const MAX_STATEMENT_BYTES = 8 * 1024 * 1024;

export function useStatementImport({ busy, setBusy, setError, setMessages, finance }) {
  const [rows, setRows] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const accounts = finance.accounts || [];
  const account = accounts.find((item) => String(item.id) === accountId) ?? accounts[0];

  const addMessage = (role, text, extra) => {
    setMessages((previous) => [...previous, { id: makeId('msg'), role, text, ...extra }]);
  };

  const attach = async (files) => {
    if (busy || !files.length) return;
    if (rows.length) return setError('Finish or cancel the current statement review first.');
    const file = files[0];
    const format = /\.(csv|pdf|xlsx)$/i.exec(file.name)?.[1].toLowerCase();
    if (files.length !== 1 || !format) return setError('Choose one CSV, PDF, or XLSX statement. Older XLS files are unsupported.');
    if (file.size === 0) return setError('This statement file is empty.');
    if (file.size > MAX_STATEMENT_BYTES) return setError('Choose a statement no larger than 8 MB.');

    setBusy(true);
    setError('');
    addMessage('user', `Attached statement: ${file.name}`);
    try {
      const { data } = await apiClient.laboImport(file, format);
      if (!data?.rows?.length) throw new Error('No readable transactions were found in this statement.');
      setAccountId(null);
      setRows(data.rows.map((row) => ({
        ...row,
        selected: row.selected === true && !row.possibleDuplicate && !row.uncertain,
      })));
    } catch (error) {
      setError(error.message || 'Could not read this statement.');
    } finally {
      setBusy(false);
    }
  };

  const update = (id, patch) => {
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const save = async () => {
    if (busy || !rows.some((row) => row.selected)) return;
    setBusy(true);
    setError('');
    try {
      const { savedIds, remainingRows, error } = await saveSelectedStatementRows(
        rows, finance.addTransaction, account ? String(account.id) : null,
      );
      setRows(remainingRows);
      if (savedIds.length) {
        const text = `Added ${savedIds.length} statement ${savedIds.length === 1 ? 'transaction' : 'transactions'}.`;
        addMessage('ai', text, { savedIds, undone: false });
      }
      if (error) setError(error.message || 'Could not save the remaining statement transactions.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setRows([]);
    setError('');
  };

  return { rows, accounts, account, setAccountId, attach, update, save, cancel };
}
