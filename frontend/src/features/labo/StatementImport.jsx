import { useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { getStatementNet } from '../../utils/financeMath';
import { money } from '../../utils/formatters';
import AccountFormModal from '../accounts/AccountFormModal';
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
        Drop a CSV, PDF, or XLSX here. PDFs with unreadable text may be sent to Meta for extraction.
      </span>
    </div>
  );
}

export function StatementAccountPicker({ statement, busy }) {
  const { addAccount } = useFinance();
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [error, setError] = useState('');

  async function createAccount(values, uiDetails) {
    if (savingAccount) return;
    setSavingAccount(true);
    try {
      const created = await addAccount(values, uiDetails);
      statement.setAccountId(String(created.id));
    } catch (err) {
      setError(err.message || 'Could not create the account.');
    } finally {
      setSavingAccount(false);
      setShowAccountForm(false);
    }
  }

  return (
    <section className="card labo-statement-review" aria-label="Choose statement account">
      <h3>Which account should I use?</h3>
      {statement.accounts.length > 0 && (
        <label className="labo-statement-account">
          Target account
          <select className="filter-select" value="" disabled={busy} onChange={(event) => statement.setAccountId(event.target.value)}>
            <option value="" disabled>Choose an account</option>
            {statement.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
      )}
      {error && <p className="negative" role="alert">{error}</p>}
      <div className="labo-statement-actions">
        <button type="button" className="btn secondary compact" disabled={busy} onClick={statement.cancel}>Cancel</button>
        <button type="button" className="btn secondary compact" disabled={busy}
          onClick={() => { setError(''); setShowAccountForm(true); }}>+ Create it here</button>
      </div>
      {showAccountForm && <AccountFormModal onClose={() => !savingAccount && setShowAccountForm(false)} onSave={createAccount} />}
    </section>
  );
}

function StatementRow({ row, categories, onChange, disabled }) {
  return (
    <tr>
      <td>
        <input
          type="checkbox"
          aria-label={`Select ${row.note} on ${row.transaction_date}`}
          checked={row.selected}
          disabled={disabled}
          onChange={(event) => onChange(row.id, { selected: event.target.checked })}
        />
      </td>
      <td><time dateTime={row.transaction_date}>{row.transaction_date}</time></td>
      <td>
        {row.note}
        {row.possibleDuplicate && <span className="status-pill due_soon">Possible duplicate</span>}
        {row.uncertain && <span className="status-pill due_soon">Check extraction</span>}
        {row.rememberedCategory && String(row.category_id ?? '') === String(row.suggestedCategoryId ?? '') && (
          <span className="status-pill paid">Remembered from last time</span>
        )}
      </td>
      <td className="align-right">{money(row.kind === 'expense' ? -row.amount : row.amount)}</td>
      <td>
        <select
          className="filter-select"
          aria-label={`Category for ${row.note} on ${row.transaction_date}`}
          value={row.category_id ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(row.id, { category_id: event.target.value })}
        >
          <option value="">Uncategorized</option>
          {categories.filter((category) => category.kind === row.kind).map((category) => (
            <option value={category.id} key={category.id}>{category.name}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export function StatementReview({ statement, categories, busy }) {
  const selected = statement.rows.filter((row) => row.selected);
  return (
    <section className="card labo-statement-review" aria-label="Statement review">
      <h3>Review statement</h3>
      <p className="muted small" aria-live="polite">
        {selected.length} of {statement.rows.length} selected · Net {money(getStatementNet(selected))}
      </p>
      <label className="labo-statement-account">
        Account
        <select
          className="filter-select"
          value={statement.account.id}
          onChange={(event) => statement.setAccountId(event.target.value)}
          disabled={busy}
        >
          {statement.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Statement transactions">
        <table className="finance-table">
          <thead>
            <tr>
              <th scope="col">Add</th>
              <th scope="col">Date</th>
              <th scope="col">Title</th>
              <th scope="col" className="align-right">Amount</th>
              <th scope="col">Category</th>
            </tr>
          </thead>
          <tbody>
            {statement.rows.map((row) => (
              <StatementRow key={row.id} row={row} categories={categories} onChange={statement.update} disabled={busy} />
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
