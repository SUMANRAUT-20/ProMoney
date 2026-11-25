import { useState } from 'react';
import { apiClient } from '../../services/api';
import { makeId, money } from '../../utils/formatters';
import { statementSheetBadge, statementSheetDetail } from './statementSheetSummary';
import {
  applyStatementAccount, saveSelectedStatementRows, statementMemoryCorrections, statementReviewNet, statementRowLabel,
} from './saveSelectedStatementRows';

function summarizeStatement({ rows, sheets, accountGroups }) {
  const summary = `${rows.length} ${rows.length === 1 ? 'transaction is' : 'transactions are'} ready to review.`;
  const details = sheets?.map((sheet) => [sheet.name, statementSheetBadge(sheet), statementSheetDetail(sheet)]
    .filter(Boolean).join(' · ')) ?? [];
  return [accountGroups ? summary : summary + ' Choose the target account.', ...details].join('\n');
}

export function useStatementImport({ busy, setBusy, setError, setMessages, finance }) {
  const [rows, setRows] = useState([]);
  const [sheets, setSheets] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const [accountGroups, setAccountGroups] = useState(null);
  const [rememberChanges, setRememberChanges] = useState(true);
  const accounts = finance.accounts || [];
  const account = accounts.find((item) => String(item.id) === accountId);
  const groupAccounts = new Map(accountGroups?.map((group) => [group.key, group.accountId]));
  const resolveAccountId = (row) => row.account_id || groupAccounts.get(row.accountGroup) || accountId || '';

  const addMessage = (role, text, extra) => {
    setMessages((previous) => [...previous, { id: makeId('msg'), role, text, ...extra }]);
  };
  const showFailure = (message) => {
    addMessage('ai', message.split('\n')[0]);
  };

  const attach = async (file, format, message) => {
    if (busy || !file) return;
    if (rows.length) return showFailure('Finish or cancel the current statement review first.');

    setBusy(true);
    setError('');
    addMessage('user', [message, `Attached statement: ${file.name}`].filter(Boolean).join('\n'));
    try {
      const { data } = await apiClient.laboImport(file, format, message);
      if (!data?.rows?.length) throw new Error('No readable transactions were found in this statement.');
      setAccountId(null);
      setSheets(data.sheets ?? []);
      setAccountGroups(data.accountGroups);
      setRememberChanges(true);
      setRows(data.rows.map((row) => ({
        ...row,
        sourceTitle: row.note,
        title: row.note,
        note: row.importNote ?? row.note,
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

  async function assignGroup(group, id) {
    setBusy(true);
    try {
      if (group.key) await apiClient.saveNidhiMemory({ accountMap: { [group.key]: id } });
    } catch {
      showFailure('The account was selected for this import. I couldn’t remember the mapping.');
    } finally {
      setAccountGroups((current) => current.map((item) => item.key === group.key ? { ...item, accountId: id } : item));
      setBusy(false);
    }
  }

  function applyToAll(id) {
    const applied = applyStatementAccount(rows, id, () => window.confirm('Replace the individual account choices for these rows?'));
    if (!applied) return;
    setRows(applied);
    setAccountId(id);
  }

  const save = async () => {
    const selected = rows.filter((row) => row.selected);
    if (busy || !selected.length) return;
    const ownedAccounts = new Set(accounts.map((item) => String(item.id)));
    const unassigned = selected.find((row) => !ownedAccounts.has(resolveAccountId(row)));
    if (unassigned) return showFailure(`Choose an account for ${statementRowLabel(unassigned)}.`);
    setBusy(true);
    setError('');
    try {
      const { savedIds, remainingRows, error } = await saveSelectedStatementRows(
        rows, finance.addTransaction, resolveAccountId,
      );
      setRows(remainingRows);
      if (savedIds.length) {
        const net = statementReviewNet(selected.slice(0, savedIds.length));
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
    setSheets([]);
    setAccountId(null);
    setAccountGroups(null);
    setError('');
    addMessage('ai', 'Statement review closed.');
  };

  return {
    rows, sheets, accounts, account, accountGroups, setAccountId, assignGroup, applyToAll, resolveAccountId,
    attach, update, save, cancel, rememberChanges, setRememberChanges,
  };
}
