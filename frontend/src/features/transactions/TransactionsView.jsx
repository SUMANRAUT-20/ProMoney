import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Download, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Amount, EmptyState, Metric, Modal, PageHeading } from '../../components/ui';
import { exportTransactionsCsv, formatDate, money } from '../../utils/formatters';
import { REFUND_KINDS } from '../../utils/financeMath';
import TransactionFormModal from './TransactionFormModal';

export default function TransactionsView() {
  const {
    transactions,
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

  useEffect(() => setSearch(searchParams.get('search') || ''), [searchParams]);

  const getCatName = (tx) =>
    categories.find((c) => String(c.id) === String(tx.category_id))?.name ||
    tx.category_name ||
    'Uncategorized';
  const getAccName = (accountId) =>
    accounts.find((a) => String(a.id) === String(accountId))?.name || 'Unassigned';
  const getTxAccount = (tx) => tx.kind === 'card_payment'
    ? `${getAccName(tx.account_id)} → ${getAccName(tx.to_account_id)}`
    : getAccName(tx.account_id);

  const query = search.trim().toLowerCase();
  const filtered = transactions
    .filter((tx) => {
      if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
      if (monthFilter && String(tx.transaction_date || '').slice(0, 7) !== monthFilter) return false;
      if (categoryFilter !== 'all' && String(tx.category_id) !== categoryFilter) return false;
      if (!query) return true;
      const text = `${tx.note || tx.title || ''} ${getCatName(tx)} ${getTxAccount(tx)}`.toLowerCase();
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
    setModalOpen(true);
  };

  const openEdit = (tx) => {
    setEditingTx(tx);
    setModalOpen(true);
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
        subtitle="Record and review your JPY income, expenses, and card payments."
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
              <option value="card_payment">Card payment</option>
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
                ? (
                  <div className="inline-editor" style={{ justifyContent: 'center' }}>
                    <button className="btn primary" type="button" onClick={openAdd}><Plus size={15} /> Add First Transaction</button>
                    <Link className="btn secondary" to="/labo">Ask Nidhi</Link>
                  </div>
                )
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
                    <td>{tx.kind === 'card_payment' ? '—' : <span className="neutral-badge">{getCatName(tx)}</span>}</td>
                    <td>{getTxAccount(tx)}</td>
                    <td><span className={`type-badge ${tx.kind}`}>{tx.kind === 'card_payment' ? 'Card payment' : tx.kind}</span></td>
                    <td className="align-right table-strong">{tx.kind === 'card_payment' ? money(tx.amount) : <Amount amount={tx.amount} type={tx.kind} />}</td>
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

      {modalOpen && <TransactionFormModal transaction={editingTx} onClose={() => setModalOpen(false)} />}

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
