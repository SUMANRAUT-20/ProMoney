import { useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { money } from '../../utils/formatters';
import AccountFormModal from '../accounts/AccountFormModal';
import { statementReviewNet, statementRowError, statementRowLabel } from './saveSelectedStatementRows';
import { statementSheetBadge, statementSheetDetail } from './statementSheetSummary';
import './statementImport.css';

export function StatementAttachment({ onAttach, disabled }) {
  const inputRef = useRef(null);
  return (
    <div className="labo-statement-actions">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.pdf,.xlsx,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        aria-label="Upload bank statement"
        onChange={(event) => {
          onAttach(event.target.files);
          event.target.value = '';
        }}
      />
      <button type="button" className="btn secondary compact" disabled={disabled}
        onClick={() => inputRef.current?.click()}>
        <Paperclip size={15} /> Attach statement
      </button>
      <span className="muted small">
        Drop a CSV, PDF, or XLSX here. Files that need cleaning may be sent to Meta.
      </span>
    </div>
  );
}

function StatementSheetList({ sheets }) {
  if (!sheets.length) return null;
  return (
    <ul className="labo-statement-sheets muted small" aria-label="Statement parsing summary">
      {sheets.map((sheet, index) => {
        const badge = statementSheetBadge(sheet);
        return <li key={index}>{sheet.name} {badge && <span className="status-pill">{badge}</span>}
          {' · '}{statementSheetDetail(sheet)}</li>;
      })}
    </ul>
  );
}

function StatementAccountPicker({ statement, group, busy }) {
  const { addAccount } = useFinance();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const chooseAccount = (id) => group ? statement.assignGroup(group, id) : statement.setAccountId(id);
  const title = group?.label ? `File says “${group.label}” — use which account?`
    : group ? 'Which account should I use for rows with no file account?' : 'Which account should I use?';

  async function createAccount(values, uiDetails) {
    const created = await addAccount(values, uiDetails);
    await chooseAccount(String(created.id));
    setShowAccountForm(false);
  }

  return (
    <section className="card labo-statement-review" aria-label={group ? title : 'Choose statement account'}>
      <h3>{title}</h3>
      {!group && <StatementSheetList sheets={statement.sheets} />}
      {statement.accounts.length > 0 && (
        <label className="labo-statement-account">
          {group ? 'Account' : 'Target account'}
          <select className="filter-select" value="" disabled={busy} onChange={(event) => chooseAccount(event.target.value)}>
            <option value="" disabled>Choose an account</option>
            {statement.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
      )}
      {group?.label && <p className="muted small">Your choice is remembered for future imports.</p>}
      <div className="labo-statement-actions">
        {!group && <button type="button" className="btn secondary compact" disabled={busy} onClick={statement.cancel}>Cancel</button>}
        <button type="button" className="btn secondary compact" disabled={busy}
          onClick={() => setShowAccountForm(true)}>{group?.label ? `+ Create “${group.label}”` : '+ Create it here'}</button>
      </div>
      {showAccountForm && <AccountFormModal initialGroup={group?.suggestedGroup ?? 'bank'} initialName={group?.label}
        onClose={() => setShowAccountForm(false)} onSave={createAccount} />}
    </section>
  );
}

function StatementRow({ row, categories, statement, disabled }) {
  const label = statementRowLabel(row);
  const issue = statementRowError(row);
  const update = (patch) => statement.update(row.id, patch);
  return (
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label={`Select ${label}`}
          checked={row.selected}
          disabled={disabled}
          onChange={(event) => update({ selected: event.target.checked })}
        />
      </td>
      <td>
        <input type="date" aria-label={`Date for ${label}`} value={row.transaction_date}
          disabled={disabled} onChange={(event) => update({ transaction_date: event.target.value })} />
      </td>
      <td>
        <input type="text" aria-label={`Title for ${label}`} value={row.title} maxLength={150}
          disabled={disabled} onChange={(event) => update({ title: event.target.value })} />
        {issue && <p className="negative small" role="alert">{issue}</p>}
        {row.possibleDuplicate && <span className="status-pill due_soon">Possible duplicate</span>}
        {row.aiIssues?.length > 0 && (
          <details>
            <summary className="status-pill due_soon">AI guessed — check</summary>
            <p className="muted small">{row.aiIssues.join(' ')}</p>
            {row.aiSource && <p className="muted small">Source row · {row.aiSource}</p>}
          </details>
        )}
        {row.uncertain && !row.aiCleaned && <span className="status-pill due_soon">AI guessed — check</span>}
        {row.rememberedCategory && String(row.category_id ?? '') === String(row.suggestedCategoryId ?? '') && (
          <span className="status-pill paid">Remembered from last time</span>
        )}
      </td>
      <td>
        <input type="number" min="1" step="1" inputMode="numeric" aria-label={`Amount for ${label}`} value={row.amount ?? ''}
          disabled={disabled} onChange={(event) => update({ amount: event.target.value })} />
        {row.aiCleaned ? (
          <select className="filter-select" aria-label={`Type for ${label}`} value={row.kind} disabled={disabled}
            onChange={(event) => update({ kind: event.target.value, category_id: '' })}>
            <option value="" disabled>Choose a type</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        ) : <span className="muted small">{row.kind === 'expense' ? 'Expense' : 'Income'}</span>}
      </td>
      <td>
        <select className="filter-select" aria-label={`Account for ${label}`} value={statement.resolveAccountId(row)}
          disabled={disabled} onChange={(event) => update({ account_id: event.target.value })}>
          <option value="" disabled>Choose an account</option>
          {statement.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </td>
      <td>
        <select
          className="filter-select"
          aria-label={`Category for ${label}`}
          value={row.category_id ?? ''}
          disabled={disabled}
          onChange={(event) => update({ category_id: event.target.value })}
        >
          <option value="">Uncategorized</option>
          {categories.filter((category) => category.kind === row.kind).map((category) => (
            <option value={category.id} key={category.id}>{category.name}</option>
          ))}
        </select>
      </td>
      <td>
        <input type="text" aria-label={`Note for ${label}`} value={row.note} maxLength={255}
          disabled={disabled} onChange={(event) => update({ note: event.target.value })} />
      </td>
    </tr>
  );
}

export function StatementReview({ statement, categories, busy }) {
  const { accountGroups, account, accounts } = statement;
  if (!accountGroups && !account) return <StatementAccountPicker statement={statement} busy={busy} />;
  const selected = statement.rows.filter((row) => row.selected);
  const parsedCount = accountGroups?.reduce((total, group) => total + group.count, 0);
  return (
    <section className="card labo-statement-review" aria-label="Statement review">
      <h3>Review statement</h3>
      <StatementSheetList sheets={statement.sheets} />
      {accountGroups && (
        <>
          <p>{parsedCount} rows: {accountGroups.map(({ label, count }) => `${label || 'No account listed'} ${count}`).join(' · ')}</p>
          {accountGroups.filter((group) => group.remembered).map((group) => (
            <p className="muted small" key={group.key}>
              {group.label} → {accounts.find((item) => String(item.id) === group.accountId)?.name} (remembered)
            </p>
          ))}
          {accountGroups.filter((group) => !group.accountId).map((group) => (
            <StatementAccountPicker key={group.key} group={group} statement={statement} busy={busy} />
          ))}
        </>
      )}
      <p className="muted small" aria-live="polite">
        {selected.length} of {statement.rows.length} selected · Net {money(statementReviewNet(selected))}
      </p>
      {!accountGroups && (
        <label className="labo-statement-account">
          Apply account to all rows
          <select className="filter-select" value="" disabled={busy} onChange={(event) => statement.applyToAll(event.target.value)}>
            <option value="" disabled>Choose account</option>
            {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Statement transactions">
        <table className="finance-table">
          <thead>
            <tr>
              <th scope="col">Add</th>
              <th scope="col">Date</th>
              <th scope="col">Title</th>
              <th scope="col" className="align-right">Amount</th>
              <th scope="col">Account</th>
              <th scope="col">Category</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {statement.rows.map((row) => (
              <StatementRow key={row.id} row={row} categories={categories} statement={statement} disabled={busy} />
            ))}
          </tbody>
        </table>
      </div>
      {selected.some((row) => String(row.category_id ?? '') !== String(row.suggestedCategoryId ?? '')) && (
        <label className="labo-statement-account">
          <input type="checkbox" checked={statement.rememberChanges} disabled={busy}
            onChange={(event) => statement.setRememberChanges(event.target.checked)} />
          Remember category changes for future imports
        </label>
      )}
      <div className="labo-statement-actions">
        <button className="btn secondary compact" type="button" onClick={statement.cancel} disabled={busy}>Cancel</button>
        <button className="btn primary compact" type="button" onClick={statement.save} disabled={busy || !selected.length}>
          Add selected
        </button>
      </div>
    </section>
  );
}
