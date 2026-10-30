
import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react';
import { EmptyState, Modal, PageHeading } from '../../components/ui';

const formatYen = (value) =>
  `¥${Number(value || 0).toLocaleString('ja-JP')}`;

const todayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDate = (value) => {
  if (!value) return 'No date';
  return parseDate(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const addMonths = (dateString, months) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();

  target.setDate(Math.min(day, lastDay));

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
};

const getStatus = (bill, today) => {
  if (bill.is_paid) return 'paid';
  if (bill.due_date < today) return 'overdue';
  return 'upcoming';
};

const getNextDueDate = (bill) => {
  if (bill.frequency === 'one_time') return null;

  return addMonths(
    bill.due_date,
    bill.frequency === 'yearly' ? 12 : 1
  );
};

const initialForm = {
  name: '',
  amount: '',
  due_date: todayString(),
  frequency: 'monthly',
  category: 'Bill',
  notes: '',
};

export default function BillsView() {
  const [bills, setBills] = useState([]);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const today = todayString();

  const monthlyTotal = bills
    .filter((bill) => bill.frequency === 'monthly')
    .reduce((sum, bill) => sum + bill.amount, 0);

  const upcomingCount = bills.filter(
    (bill) => getStatus(bill, today) === 'upcoming'
  ).length;

  const overdueCount = bills.filter(
    (bill) => getStatus(bill, today) === 'overdue'
  ).length;

  const paidCount = bills.filter((bill) => bill.is_paid).length;

  const filteredBills = bills
    .filter((bill) => {
      if (filter === 'all') return true;
      return getStatus(bill, today) === filter;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const updateForm = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError('');
  };

  const openAddModal = () => {
    setEditingBill(null);
    setForm({
      ...initialForm,
      due_date: todayString(),
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (bill) => {
    setEditingBill(bill);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      due_date: bill.due_date,
      frequency: bill.frequency,
      category: bill.category,
      notes: bill.notes || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBill(null);
    setError('');
  };

  const handleSave = (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const amountText = String(form.amount).trim();

    if (!name) {
      setError('Please enter a bill or subscription name.');
      return;
    }

    if (name.length > 100) {
      setError('Name must be 100 characters or fewer.');
      return;
    }

    if (!/^[1-9]\d*$/.test(amountText)) {
      setError('Enter a positive whole-yen amount.');
      return;
    }

    const amount = Number(amountText);

    if (!Number.isSafeInteger(amount)) {
      setError('The amount is too large.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.due_date)) {
      setError('Please select a valid due date.');
      return;
    }

    const date = parseDate(form.due_date);

    if (
      Number.isNaN(date.getTime()) ||
      todayStringFromDate(date) !== form.due_date
    ) {
      setError('Please select a valid due date.');
      return;
    }

    const nextBill = {
      id: editingBill?.id ?? crypto.randomUUID(),
      name,
      amount,
      due_date: form.due_date,
      frequency: form.frequency,
      category: form.category,
      notes: form.notes.trim(),
      is_paid: editingBill?.is_paid ?? false,
    };

    setBills((previous) => {
      if (editingBill) {
        return previous.map((bill) =>
          bill.id === editingBill.id ? nextBill : bill
        );
      }

      return [...previous, nextBill];
    });

    closeModal();
  };

  const togglePaid = (id) => {
    setBills((previous) =>
      previous.map((bill) =>
        bill.id === id
          ? { ...bill, is_paid: !bill.is_paid }
          : bill
      )
    );
  };

  const advanceRecurringBill = (id) => {
    setBills((previous) =>
      previous.map((bill) => {
        if (bill.id !== id || !bill.is_paid) return bill;

        const nextDate = getNextDueDate(bill);
        if (!nextDate) return bill;

        return {
          ...bill,
          due_date: nextDate,
          is_paid: false,
        };
      })
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    setBills((previous) =>
      previous.filter((bill) => bill.id !== deleteTarget.id)
    );

    setDeleteTarget(null);
  };

  return (
    <>
      <PageHeading
        title="Bills & Subscriptions"
        subtitle="Manage recurring payments, due dates, and subscriptions in JPY."
        action={
          <button
            className="btn primary"
            type="button"
            onClick={openAddModal}
          >
            <Plus size={17} />
            Add Bill
          </button>
        }
      />

      <section
        className="metrics-grid"
        style={{ marginBottom: 18 }}
      >
        <div className="metric card">
          <div className="metric-icon green">
            <Wallet size={19} />
          </div>
          <div>
            <span className="metric-label">Monthly recurring</span>
            <strong className="metric-number">
              {formatYen(monthlyTotal)}
            </strong>
          </div>
        </div>

        <div className="metric card">
          <div className="metric-icon">
            <CalendarDays size={19} />
          </div>
          <div>
            <span className="metric-label">Upcoming</span>
            <strong className="metric-number">{upcomingCount}</strong>
          </div>
        </div>

        <div className="metric card">
          <div className="metric-icon">
            <Clock3 size={19} />
          </div>
          <div>
            <span className="metric-label">Overdue</span>
            <strong className="metric-number">{overdueCount}</strong>
          </div>
        </div>

        <div className="metric card">
          <div className="metric-icon">
            <CheckCircle2 size={19} />
          </div>
          <div>
            <span className="metric-label">Paid</span>
            <strong className="metric-number">{paidCount}</strong>
          </div>
        </div>
      </section>

      <section className="section-card card">
        <div
          className="section-title"
          style={{ marginBottom: 12 }}
        >
          <h2>Scheduled Payments</h2>
          <span className="support-note">
            {bills.length} total
          </span>
        </div>

        <div
          className="segmented"
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          {[
            ['all', 'All'],
            ['upcoming', 'Upcoming'],
            ['paid', 'Paid'],
            ['overdue', 'Overdue'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'selected' : ''}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredBills.length === 0 ? (
          <EmptyState
            icon="🧾"
            title={
              bills.length === 0
                ? 'No bills added yet'
                : `No ${filter} bills`
            }
            description={
              bills.length === 0
                ? 'Select Add Bill to create your first scheduled payment.'
                : 'Try another filter to see your scheduled payments.'
            }
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredBills.map((bill) => {
              const status = getStatus(bill, today);
              const isRecurring = bill.frequency !== 'one_time';

              return (
                <article
                  key={bill.id}
                  className="card"
                  style={{ padding: 18 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        {bill.category === 'Subscription' ? (
                          <CreditCard size={19} />
                        ) : (
                          <ReceiptText size={19} />
                        )}
                        <h3 style={{ margin: 0 }}>{bill.name}</h3>
                      </div>

                      <p className="support-note">
                        {bill.category} ·{' '}
                        {bill.frequency === 'one_time'
                          ? 'One-time'
                          : bill.frequency === 'yearly'
                            ? 'Yearly'
                            : 'Monthly'}
                      </p>

                      <p className="support-note">
                        Due: {formatDate(bill.due_date)}
                      </p>

                      {bill.notes && (
                        <p className="support-note">
                          Notes: {bill.notes}
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: 19 }}>
                        {formatYen(bill.amount)}
                      </strong>
                      <p
                        style={{
                          margin: '6px 0',
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            status === 'overdue'
                              ? '#c44d4d'
                              : status === 'paid'
                                ? '#299365'
                                : 'var(--muted)',
                        }}
                      >
                        {status.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 14,
                    }}
                  >
                    <button
                      type="button"
                      className="btn"
                      onClick={() => togglePaid(bill.id)}
                    >
                      <CheckCircle2 size={15} />
                      {bill.is_paid ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>

                    {bill.is_paid && isRecurring && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => advanceRecurringBill(bill.id)}
                      >
                        <RotateCcw size={15} />
                        Next Cycle
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn"
                      onClick={() => openEditModal(bill)}
                    >
                      <Pencil size={15} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="btn"
                      onClick={() => setDeleteTarget(bill)}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="support-note">
        Bills are stored in temporary page memory only.
        Refreshing the page clears them.
        Scheduled bills do not automatically create expense transactions.
      </p>

      {isModalOpen && (
        <Modal
          title={editingBill ? 'Edit Bill' : 'Add Bill'}
          onClose={closeModal}
        >
          <form className="form" onSubmit={handleSave}>
            <label>
              Bill / Subscription Name
              <input
                type="text"
                value={form.name}
                onChange={(event) =>
                  updateForm('name', event.target.value)
                }
                placeholder="e.g. Internet"
                maxLength={100}
                required
              />
            </label>

            <label>
              Type
              <select
                value={form.category}
                onChange={(event) =>
                  updateForm('category', event.target.value)
                }
              >
                <option value="Bill">Bill</option>
                <option value="Subscription">Subscription</option>
              </select>
            </label>

            <label>
              Amount (JPY)
              <input
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={(event) =>
                  updateForm('amount', event.target.value)
                }
                placeholder="Enter amount in yen"
                required
              />
            </label>

            <label>
              Due Date
              <input
                type="date"
                value={form.due_date}
                onChange={(event) =>
                  updateForm('due_date', event.target.value)
                }
                required
              />
            </label>

            <label>
              Frequency
              <select
                value={form.frequency}
                onChange={(event) =>
                  updateForm('frequency', event.target.value)
                }
              >
                <option value="one_time">One-time</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            <label>
              Notes (Optional)
              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateForm('notes', event.target.value)
                }
                placeholder="Add payment details or reminders"
                rows={3}
                maxLength={500}
              />
            </label>

            {error && (
              <p role="alert" className="negative">
                {error}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn"
                type="button"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                type="submit"
              >
                {editingBill ? 'Save Changes' : 'Add Bill'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete Bill"
          onClose={() => setDeleteTarget(null)}
        >
          <p>
            Are you sure you want to delete{' '}
            <strong>{deleteTarget.name}</strong>?
          </p>
          <p className="support-note">
            This action cannot be undone during this session.
          </p>

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={confirmDelete}
            >
              Delete Bill
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function todayStringFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
