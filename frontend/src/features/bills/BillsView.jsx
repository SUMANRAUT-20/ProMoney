import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Pencil, Plus, ReceiptText, RotateCcw, Trash2, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { EmptyState, Metric, Modal, PageHeading } from '../../components/ui';
import { daysBetweenISO, formatDate, isValidISODate, money, parseWholeYen, sum, todayISO } from '../../utils/formatters';
import { getBillStatus } from '../../utils/financeMath';

const STATUS_LABELS = { overdue: 'Overdue', due_soon: 'Due Soon', upcoming: 'Upcoming', paid: 'Paid' };

function describeDue(bill, status, today) {
  if (status === 'paid') return `Paid · Due ${formatDate(bill.due_date)}`;
  const diff = daysBetweenISO(today, bill.due_date);
  if (diff < 0) return `${Math.abs(diff)}d overdue · ${formatDate(bill.due_date)}`;
  if (diff === 0) return `Due today · ${formatDate(bill.due_date)}`;
  return `In ${diff}d · ${formatDate(bill.due_date)}`;
}

export default function BillsView() {
  const { bills, addBill, editBill, toggleBillPaid, advanceBillCycle, removeBill, categories } = useFinance();
  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  const defaultCategory = expenseCategories[0]?.name || 'Utilities';

  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', amount: '', due_date: todayISO(), category: defaultCategory, frequency: 'monthly', is_paid: false, notes: '',
  });

  const today = todayISO();
  const unpaidTotal = sum(bills.filter((b) => !b.is_paid), 'amount');
  const dueSoonCount = bills.filter((b) => getBillStatus(b, today) === 'due_soon').length;
  const overdueCount = bills.filter((b) => getBillStatus(b, today) === 'overdue').length;
  const paidCount = bills.filter((b) => b.is_paid).length;

  const filteredBills = bills
    .filter((b) => (filter === 'all' ? true : getBillStatus(b, today) === filter))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const openAdd = () => {
    setEditingBill(null);
    setForm({ name: '', amount: '', due_date: today, category: defaultCategory, frequency: 'monthly', is_paid: false, notes: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (bill) => {
    setEditingBill(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      due_date: bill.due_date,
      category: bill.category || defaultCategory,
      frequency: bill.frequency || 'monthly',
      is_paid: Boolean(bill.is_paid),
      notes: bill.notes || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const notes = form.notes.trim();
    const amount = parseWholeYen(form.amount);
    if (!name || name.length > 80) return setError('Enter a bill name (1–80 characters).');
    if (amount === null) return setError('Amount must be a whole number greater than ¥0.');
    if (!isValidISODate(form.due_date)) return setError('Select a valid due date (YYYY-MM-DD).');
    if (!form.category) return setError('Select a category.');
    if (notes.length > 200) return setError('Notes must be 200 characters or fewer.');

    const payload = {
      name,
      amount,
      due_date: form.due_date,
      category: form.category,
      frequency: form.frequency,
      is_paid: Boolean(form.is_paid),
      notes,
    };
    try {
      if (editingBill) await editBill(editingBill.id, payload);
      else await addBill(payload);
      setModalOpen(false);
    } catch (err) {
      setError(err.message || 'Could not save bill.');
    }
  };

  return (
    <>
      <PageHeading
        title="Bills & Subscriptions"
        subtitle="Track upcoming bills, due-soon reminders, overdue items, and payment status in JPY."
        action={<button className="btn primary" type="button" onClick={openAdd}><Plus size={16} /> Add Bill</button>}
      />

      <section className="dashboard-metrics" style={{ marginBottom: 16 }}>
        <Metric icon={Wallet} label="Unpaid bills total" value={money(unpaidTotal)} small="Remaining unpaid" />
        <Metric icon={Clock3} label="Due soon (next 7d)" value={dueSoonCount} small="Needs attention soon" />
        <Metric icon={AlertTriangle} label="Overdue" value={overdueCount} small="Past due date" />
        <Metric icon={CheckCircle2} label="Paid" value={paidCount} small="Completed bills" />
      </section>

      <section className="section-card card">
        <div className="section-toolbar" style={{ flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Scheduled Bills ({bills.length})</h2>
          <div className="segmented" style={{ flexWrap: 'wrap' }}>
            {[['all', 'All'], ['due_soon', 'Due Soon'], ['upcoming', 'Upcoming'], ['overdue', 'Overdue'], ['paid', 'Paid']].map(([val, label]) => (
              <button key={val} type="button" className={filter === val ? 'selected' : ''} onClick={() => setFilter(val)}>{label}</button>
            ))}
          </div>
        </div>

        {filteredBills.length === 0 ? (
          <EmptyState
            icon="🧾"
            title={bills.length === 0 ? 'No bills scheduled yet' : 'No bills match this status'}
            description={bills.length === 0 ? 'Add rent, utilities, phone, or subscriptions to track due dates.' : 'Switch filters or add a new scheduled bill.'}
            action={
              bills.length === 0
                ? <button className="btn primary" type="button" onClick={openAdd}><Plus size={15} /> Add First Bill</button>
                : <button className="btn secondary" type="button" onClick={() => setFilter('all')}>Show All Bills</button>
            }
          />
        ) : (
          <div>
            {filteredBills.map((bill) => {
              const status = getBillStatus(bill, today);
              return (
                <div key={bill.id} className="bill-row" style={{ flexWrap: 'wrap' }}>
                  <div className="bill-icon"><ReceiptText size={18} /></div>
                  <div style={{ minWidth: 180, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong>{bill.name}</strong>
                      <span className={`status-pill ${status}`}>{STATUS_LABELS[status]}</span>
                    </div>
                    <p className="muted">
                      {bill.category} · {bill.frequency === 'one_time' ? 'One-time' : bill.frequency === 'yearly' ? 'Yearly' : 'Monthly'} · {describeDue(bill, status, today)}
                      {bill.notes ? ` · ${bill.notes}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
                    <strong style={{ fontSize: 16, marginRight: 6 }}>{money(bill.amount)}</strong>
                    <button className={`btn compact ${bill.is_paid ? 'secondary' : 'primary'}`} type="button" onClick={() => toggleBillPaid(bill.id)}>
                      <CheckCircle2 size={14} /> {bill.is_paid ? 'Mark Unpaid' : 'Mark as Paid'}
                    </button>
                    {bill.is_paid && bill.frequency !== 'one_time' && (
                      <button className="btn secondary compact" type="button" onClick={() => advanceBillCycle(bill)}>
                        <RotateCcw size={14} /> Next Cycle
                      </button>
                    )}
                    <button className="btn secondary compact" type="button" onClick={() => openEdit(bill)} aria-label={`Edit ${bill.name}`}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="btn secondary compact" type="button" onClick={() => setDeleteTarget(bill)} aria-label={`Delete ${bill.name}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modalOpen && (
        <Modal title={editingBill ? 'Edit Bill' : 'Add Bill'} onClose={() => setModalOpen(false)}>
          <form className="form" onSubmit={handleSave} noValidate>
            <label>
              Bill Name
              <input type="text" value={form.name} maxLength={80} placeholder="e.g. Electricity & Gas" onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(''); }} required />
            </label>
            <div className="form-row">
              <label>
                Amount (JPY)
                <input type="number" min="1" step="1" value={form.amount} placeholder="e.g. 7200" onChange={(e) => { setForm({ ...form, amount: e.target.value }); setError(''); }} required />
              </label>
              <label>
                Due Date
                <input type="date" value={form.due_date} onChange={(e) => { setForm({ ...form, due_date: e.target.value }); setError(''); }} required />
              </label>
            </div>
            <div className="form-row">
              <label>
                Category
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {expenseCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  {!expenseCategories.some((c) => c.name === form.category) && form.category && <option value={form.category}>{form.category}</option>}
                </select>
              </label>
              <label>
                Frequency
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One-time</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Payment Status
                <select value={form.is_paid ? 'paid' : 'unpaid'} onChange={(e) => setForm({ ...form, is_paid: e.target.value === 'paid' })}>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <label>
                Note (Optional)
                <input type="text" value={form.notes} maxLength={200} placeholder="Optional reminder" onChange={(e) => { setForm({ ...form, notes: e.target.value }); setError(''); }} />
              </label>
            </div>
            {error && <p role="alert" className="negative" style={{ margin: 0 }}>{error}</p>}
            <div className="form-actions">
              <button className="btn secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit">{editingBill ? 'Save Changes' : 'Add Bill'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Bill" onClose={() => setDeleteTarget(null)}>
          <p>Delete <strong>{deleteTarget.name}</strong> ({money(deleteTarget.amount)})?</p>
          <div className="form-actions">
            <button className="btn secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="btn primary"
              type="button"
              onClick={async () => {
                await removeBill(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete Bill
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
