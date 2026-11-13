import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Download, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Amount, EmptyState, Metric, Modal, PageHeading } from '../../components/ui';
import { exportTransactionsCsv, formatDate, isValidISODate, money, parseWholeYen, todayISO } from '../../utils/formatters';
import { REFUND_KINDS } from '../../utils/financeMath';

export default function TransactionsView() {
  const {
    transactions,
    addTransaction,
    editTransaction,
    removeTransaction,
    accounts,
    categories,
  } = useFinance();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [monthFilter, setMonthFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => setSearch(searchParams.get('search') || ''), [searchParams]);

  const firstCatForKind = (kind) => categories.find((c) => c.kind === kind)?.id || '';
  const defaultAccountId = accounts[0]?.id ? String(accounts[0].id) : '';

  const [form, setForm] = useState({
    kind: 'expense',
    amount: '',
    category_id: firstCatForKind('expense'),
    account_id: defaultAccountId,
    transaction_date: todayISO(),
    note: '',
  });

  const getCatName = (tx) =>
    categories.find((c) => String(c.id) === String(tx.category_id))?.name ||
    tx.category_name ||
    'Uncategorized';
  const getAccName = (accountId) =>
    accounts.find((a) => String(a.id) === String(accountId))?.name || 'Unassigned';

  const query = search.trim().toLowerCase();
  const filtered = transactions
    .filter((tx) => {
      if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
      if (monthFilter && String(tx.transaction_date || '').slice(0, 7) !== monthFilter) return false;
      if (categoryFilter !== 'all' && String(tx.category_id) !== categoryFilter) return false;
      if (!query) return true;
      const text = `${tx.note || tx.title || ''} ${getCatName(tx)} ${getAccName(tx.account_id)}`.toLowerCase();
      return text.includes(query);
    })
    .sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)));

  let periodIncome = 0;
  let periodExpense = 0;
  for (const tx of filtered) {
    const amt = Number(tx.amount || 0);
    if (tx.kind === 'income') periodIncome += amt;
    else if (tx.kind === 'expense') periodExpense += amt;
    else if (REFUND_KINDS.includes(tx.kind)) periodExpense -= amt;
  }
  periodExpense = Math.max(0, periodExpense);

  const openAdd = () => {
    setEditingTx(null);
    setForm({
      kind: 'expense',
      amount: '',
      category_id: firstCatForKind('expense'),
      account_id: accounts[0]?.id ? String(accounts[0].id) : '',
      transaction_date: todayISO(),
      note: '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (tx) => {
    setEditingTx(tx);
    setForm({
      kind: tx.kind,
      amount: String(tx.amount),
      category_id: String(tx.category_id || firstCatForKind(tx.kind)),
      account_id: tx.account_id ? String(tx.account_id) : defaultAccountId,
      transaction_date: tx.transaction_date,
      note: tx.note || tx.title || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!['income', 'expense'].includes(form.kind)) return setError('Choose income or expense.');
    const amount = parseWholeYen(form.amount);
    if (amount === null) return setError('Amount must be a whole number greater than ¥0.');
    const cat = categories.find((c) => String(c.id) === String(form.category_id) && c.kind === form.kind);
    if (!cat) return setError('Please select a valid category.');
    if (accounts.length > 0 && !accounts.some((a) => String(a.id) === String(form.account_id))) {
      return setError('Please select a valid account.');
    }
    if (!isValidISODate(form.transaction_date)) return setError('Please select a valid date (YYYY-MM-DD).');
    const note = form.note.trim();
    if (!note || note.length > 120) return setError('Enter a short note (1–120 characters).');

    const payload = {
      kind: form.kind,
      amount,
      category_id: cat.id,
      category_name: cat.name,
      account_id: accounts.length > 0 ? form.account_id : null,
      transaction_date: form.transaction_date,
      note,
      title: note,
    };
    try {
      if (editingTx) await editTransaction(editingTx.id, payload);
      else await addTransaction(payload);
      setModalOpen(false);
    } catch (err) {
      setError(err.message || 'Could not save transaction.');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setMonthFilter('');
    setCategoryFilter('all');
    setKindFilter('all');
    if (searchParams.has('search')) setSearchParams({});
  };

  return (
    <>
      <PageHeading
        title="Transactions"
        subtitle="Record, search, filter, and export your JPY income and expenses."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn secondary"
              type="button"
              title="Export CSV"
              aria-label="Export CSV"
              disabled={filtered.length === 0}
              onClick={() => exportTransactionsCsv(filtered, getCatName, getAccName)}
            >
              <Download size={15} /> Export CSV
            </button>
            <button className="btn primary" type="button" title="Add Transaction" aria-label="Add Transaction" onClick={openAdd}>
              <Plus size={16} /> Add Transaction
            </button>
          </div>
        }
      />

      <section className="metrics-grid" style={{ marginBottom: 16 }}>
        <Metric icon={ArrowDownLeft} label="Period income" value={money(periodIncome)} small={`${filtered.filter((t) => t.kind === 'income').length} entries`} />
        <Metric icon={ArrowUpRight} label="Period expenses" value={money(periodExpense)} small={`${filtered.filter((t) => t.kind === 'expense').length} entries`} />
        <Metric icon={Scale} label="Period balance" value={money(periodIncome - periodExpense)} small="Income minus expenses" />
      </section>

      <section className="section-card card">
        <div className="section-toolbar" style={{ flexWrap: 'wrap' }}>
          <input className="filter-input" type="search" value={search} placeholder="Search by note, category, or account..." aria-label="Search transactions" onChange={(e) => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="filter-select" type="month" value={monthFilter} aria-label="Filter by month" onChange={(e) => setMonthFilter(e.target.value)} />
            {monthFilter && <button className="btn secondary compact" type="button" onClick={() => setMonthFilter('')}>All Months</button>}
            <select className="filter-select" value={categoryFilter} aria-label="Filter by category" onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="filter-select" value={kindFilter} aria-label="Filter by type" onChange={(e) => setKindFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="💳"
            title={transactions.length === 0 ? 'No transactions recorded yet' : 'No matching transactions'}
            description={transactions.length === 0 ? 'Add your income and expenses to keep balances, budgets, and reports updated.' : 'Adjust your search or clear active filters to view entries.'}
            action={
              transactions.length === 0
                ? <button className="btn primary" type="button" onClick={openAdd}><Plus size={15} /> Add First Transaction</button>
                : <button className="btn secondary" type="button" onClick={resetFilters}>Reset Filters</button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Date</th><th>Note</th><th>Category</th><th>Account</th><th>Type</th>
                  <th className="align-right">Amount</th><th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.transaction_date)}</td>
                    <td className="table-strong">{tx.note || tx.title}</td>
                    <td><span className="neutral-badge">{getCatName(tx)}</span></td>
                    <td>{getAccName(tx.account_id)}</td>
                    <td><span className={`type-badge ${tx.kind}`}>{tx.kind}</span></td>
                    <td className="align-right table-strong"><Amount amount={tx.amount} type={tx.kind} /></td>
                    <td className="align-right">
                      <button className="icon-button" type="button" onClick={() => openEdit(tx)} aria-label={`Edit ${tx.note || tx.title}`}><Pencil size={15} /></button>
                      <button className="icon-button" type="button" onClick={() => setDeleteTarget(tx)} aria-label={`Delete ${tx.note || tx.title}`}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <Modal title={editingTx ? 'Edit Transaction' : 'Add Transaction'} onClose={() => setModalOpen(false)}>
          <form className="form" onSubmit={handleSave} noValidate>
            <div className="segmented">
              {['expense', 'income'].map((k) => (
                <button key={k} type="button" style={{ flex: 1, textTransform: 'capitalize' }} className={form.kind === k ? 'selected' : ''} onClick={() => { setForm({ ...form, kind: k, category_id: firstCatForKind(k) }); setError(''); }}>{k}</button>
              ))}
            </div>
            <div className="form-row">
              <label>
                Amount (JPY)
                <input type="number" min="1" step="1" value={form.amount} placeholder="e.g. 3200" onChange={(e) => { setForm({ ...form, amount: e.target.value }); setError(''); }} required />
              </label>
              <label>
                Date
                <input type="date" value={form.transaction_date} onChange={(e) => { setForm({ ...form, transaction_date: e.target.value }); setError(''); }} required />
              </label>
            </div>
            <div className="form-row">
              <label>
                Category
                <select value={form.category_id} onChange={(e) => { setForm({ ...form, category_id: e.target.value }); setError(''); }}>
                  {categories.filter((c) => c.kind === form.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                Account
                <select value={form.account_id} onChange={(e) => { setForm({ ...form, account_id: e.target.value }); setError(''); }} disabled={accounts.length === 0}>
                  {accounts.length === 0 ? <option value="">Unassigned (add account first)</option> : accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            </div>
            <label>
              Note
              <input type="text" value={form.note} maxLength={120} placeholder="e.g. Supermarket groceries" onChange={(e) => { setForm({ ...form, note: e.target.value }); setError(''); }} required />
            </label>
            {error && <p className="negative" role="alert" style={{ margin: 0 }}>{error}</p>}
            <div className="form-actions">
              <button className="btn secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit">{editingTx ? 'Save Changes' : 'Add Transaction'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Transaction" onClose={() => setDeleteTarget(null)}>
          <p>Delete <strong>{deleteTarget.note || deleteTarget.title}</strong> ({money(deleteTarget.amount)})?</p>
          <div className="form-actions">
            <button className="btn secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="btn primary"
              type="button"
              onClick={async () => {
                await removeTransaction(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
