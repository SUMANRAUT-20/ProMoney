import { useState } from 'react';
import { Modal } from '../../components/ui';
import { useFinance } from '../../context/FinanceContext';
import { isCardPaymentDestination, isCardPaymentSource } from '../../utils/financeMath';
import { isValidISODate, parseWholeYen, todayISO } from '../../utils/formatters';

export default function TransactionFormModal({ transaction, onClose }) {
  const { accounts, categories, addTransaction, editTransaction } = useFinance();
  const firstCategory = (kind) => categories.find((category) => category.kind === kind)?.id ?? '';
  const [form, setForm] = useState(() => ({
    kind: transaction?.kind ?? 'expense',
    amount: transaction ? String(transaction.amount) : '',
    category_id: String(transaction?.category_id ?? firstCategory(transaction?.kind ?? 'expense')),
    account_id: String(transaction?.account_id ?? accounts[0]?.id ?? ''),
    to_account_id: String(transaction?.to_account_id ?? ''),
    transaction_date: transaction?.transaction_date ?? todayISO(),
    note: transaction?.note ?? transaction?.title ?? '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isPayment = form.kind === 'card_payment';
  const sources = accounts.filter(isCardPaymentSource);
  const cards = accounts.filter(isCardPaymentDestination);
  const accountChoices = isPayment ? sources : accounts;
  const kinds = transaction?.kind === 'card_payment' ? [] : ['expense', 'income', 'card_payment'];

  function change(patch) {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  }

  function selectKind(kind) {
    let accountId = form.account_id;
    if (kind === 'card_payment' && !sources.some((account) => String(account.id) === accountId)) {
      accountId = String(sources[0]?.id ?? '');
    }
    change({ kind, category_id: String(firstCategory(kind)), account_id: accountId });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;
    if (!isPayment && !['income', 'expense'].includes(form.kind)) return setError('Choose a transaction type.');
    const amount = parseWholeYen(form.amount);
    if (amount === null) return setError('Amount must be a whole number greater than ¥0.');
    if (!isValidISODate(form.transaction_date)) return setError('Please select a valid date (YYYY-MM-DD).');
    const category = categories.find((item) => String(item.id) === form.category_id && item.kind === form.kind);
    if (!isPayment && !category) return setError('Please select a valid category.');
    if ((isPayment || accounts.length > 0) && !accountChoices.some((item) => String(item.id) === form.account_id)) {
      return setError(isPayment ? 'Choose an account to pay from.' : 'Please select a valid account.');
    }
    if (isPayment && !cards.some((item) => String(item.id) === form.to_account_id)) {
      return setError('Choose a credit card or BNPL account to pay.');
    }
    const note = form.note.trim() || (isPayment ? 'Card payment' : '');
    if (!note || note.length > 120) return setError('Enter a short note (1–120 characters).');

    setSaving(true);
    try {
      const payload = {
        kind: form.kind, amount, transaction_date: form.transaction_date, note,
        category_id: isPayment ? null : category.id,
        category_name: isPayment ? null : category.name,
        account_id: form.account_id || null,
        to_account_id: isPayment ? form.to_account_id : null,
      };
      if (transaction) await editTransaction(transaction.id, payload);
      else await addTransaction(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={transaction ? 'Edit Transaction' : 'Add Transaction'} onClose={() => !saving && onClose()}>
      <form className="form" onSubmit={handleSave} noValidate>
        {kinds.length > 0 && (
          <div className="segmented">
            {kinds.map((kind) => (
              <button key={kind} type="button" aria-pressed={form.kind === kind} style={{ flex: 1 }} className={form.kind === kind ? 'selected' : ''} onClick={() => selectKind(kind)}>
                {{ expense: 'Expense', income: 'Income', card_payment: 'Card payment' }[kind]}
              </button>
            ))}
          </div>
        )}
        <div className="form-row">
          <label>
            Amount (JPY)
            <input type="number" min="1" step="1" value={form.amount} placeholder="e.g. 3200" onChange={(event) => change({ amount: event.target.value })} required />
          </label>
          <label>
            Date
            <input type="date" value={form.transaction_date} onChange={(event) => change({ transaction_date: event.target.value })} required />
          </label>
        </div>
        <div className="form-row">
          {isPayment ? (
            <label>
              Pay to
              <select name="to_account_id" value={form.to_account_id} onChange={(event) => change({ to_account_id: event.target.value })} required>
                <option value="">Select a credit card or BNPL account</option>
                {cards.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
          ) : (
            <label>
              Category
              <select value={form.category_id} onChange={(event) => change({ category_id: event.target.value })}>
                {categories.filter((category) => category.kind === form.kind).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          )}
          <label>
            {isPayment ? 'Pay from' : 'Account'}
            <select name="account_id" value={form.account_id} onChange={(event) => change({ account_id: event.target.value })} disabled={accountChoices.length === 0}>
              {accountChoices.length === 0 && <option value="">{isPayment ? 'Add an asset account first' : 'Unassigned (add account first)'}</option>}
              {accountChoices.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        </div>
        <label>
          Note
          <input type="text" value={form.note} maxLength={120} placeholder={isPayment ? 'Card payment' : 'e.g. Supermarket groceries'} onChange={(event) => change({ note: event.target.value })} required={!isPayment} />
        </label>
        {error && <p className="negative" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="form-actions">
          <button className="btn secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn primary" type="submit" disabled={saving}>{transaction ? 'Save Changes' : 'Add Transaction'}</button>
        </div>
      </form>
    </Modal>
  );
}
