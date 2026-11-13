import { useState } from 'react';
import { AlertTriangle, CalendarDays, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { EmptyState, Modal, PageHeading, ProgressBar } from '../../components/ui';
import { currentMonthISO, formatMonth, money, parseWholeYen, sum, todayISO } from '../../utils/formatters';
import { getBudgetStatus } from '../../utils/financeMath';

export default function BudgetsView() {
  const { budgets, saveBudget, removeBudget, transactions, categories } = useFinance();
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [amountLimit, setAmountLimit] = useState('');
  const [error, setError] = useState('');

  const today = todayISO();
  const monthlyBudgets = budgets
    .filter((b) => String(b.budget_month || '').slice(0, 7) === selectedMonth)
    .map((b) => getBudgetStatus(b, transactions, today));

  const totalLimit = sum(monthlyBudgets, 'amount_limit');
  const totalSpent = sum(monthlyBudgets, 'spent_amount');
  const totalRemaining = totalLimit - totalSpent;
  const overBudgetItems = monthlyBudgets.filter((b) => b.over_budget);

  const openAdd = () => {
    const usedIds = new Set(monthlyBudgets.map((b) => String(b.category_id)));
    const firstAvailable = expenseCategories.find((c) => !usedIds.has(String(c.id)));
    setEditingBudget(null);
    setCategoryId(firstAvailable ? String(firstAvailable.id) : '');
    setAmountLimit('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (budget) => {
    setEditingBudget(budget);
    setCategoryId(String(budget.category_id));
    setAmountLimit(String(budget.amount_limit));
    setError('');
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
      return setError('Select a valid budget month (YYYY-MM).');
    }
    const category = expenseCategories.find((c) => String(c.id) === String(categoryId));
    if (!category) return setError('Please select an expense category.');
    const limit = parseWholeYen(amountLimit);
    if (limit === null) return setError('Monthly limit must be a whole number greater than ¥0.');

    const duplicate = budgets.some(
      (b) =>
        String(b.budget_month).slice(0, 7) === selectedMonth &&
        String(b.category_id) === String(category.id) &&
        b.id !== editingBudget?.id,
    );
    if (duplicate) return setError(`${category.name} already has a budget for ${formatMonth(selectedMonth)}.`);

    const payload = {
      category_id: category.id,
      category_name: category.name,
      budget_month: selectedMonth,
      amount_limit: limit,
    };
    try {
      await saveBudget(payload, editingBudget?.id ?? null);
      setModalOpen(false);
    } catch (err) {
      setError(err.message || 'Could not save budget.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await removeBudget(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <>
      <PageHeading
        title="Monthly Budgets"
        subtitle="Set monthly JPY category limits with live spending tracked from transactions."
        action={
          <button className="btn primary" type="button" onClick={openAdd}>
            <Plus size={16} /> Add Budget
          </button>
        }
      />

      {overBudgetItems.length > 0 && (
        <div className="status-banner danger" role="alert">
          <AlertTriangle size={18} color="var(--red)" />
          <div>
            <strong>
              Over-Budget Warning ({overBudgetItems.length} {overBudgetItems.length === 1 ? 'category' : 'categories'})
            </strong>
            <span>
              {overBudgetItems
                .map((b) => `${b.category_name} exceeded by ${money(Math.abs(b.remaining_amount))}`)
                .join(' · ')}
            </span>
          </div>
        </div>
      )}

      <section className="section-card card">
        <div className="section-title" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
          <h2>Budget Period</h2>
          <label className="inline-editor" style={{ marginTop: 0, alignItems: 'center' }}>
            <CalendarDays size={18} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              aria-label="Budget month"
            />
          </label>
        </div>
      </section>

      <section className="budget-overview card">
        <div>
          <span className="eyebrow">MONTHLY BUDGET OVERVIEW · {formatMonth(selectedMonth)}</span>
          <h2>
            {money(totalSpent)} / {money(totalLimit)}
          </h2>
          <p className={totalRemaining < 0 ? 'negative' : ''}>
            {totalRemaining < 0
              ? `Over total budget by ${money(Math.abs(totalRemaining))}`
              : `Remaining across budgeted categories: ${money(totalRemaining)}`}
          </p>
        </div>
        <div className="illustration-circle">
          <Wallet size={28} />
        </div>
      </section>

      {monthlyBudgets.length === 0 ? (
        <EmptyState
          icon="📊"
          title={`No budgets set for ${formatMonth(selectedMonth)}`}
          description="Set spending limits on categories like Groceries, Housing, or Food & Dining."
          action={
            <button className="btn primary" type="button" onClick={openAdd}>
              <Plus size={15} /> Add First Budget
            </button>
          }
        />
      ) : (
        <section className="budget-grid">
          {monthlyBudgets.map((budget) => (
            <article className="budget-card card" key={budget.id}>
              <div className="budget-top">
                <h3>{budget.category_name}</h3>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-button" type="button" onClick={() => openEdit(budget)} aria-label={`Edit ${budget.category_name} budget`}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-button" type="button" onClick={() => setDeleteTarget(budget)} aria-label={`Delete ${budget.category_name} budget`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="budget-figures">
                <strong>{money(budget.spent_amount)}</strong>
                <span>of {money(budget.amount_limit)}</span>
              </div>

              <ProgressBar
                current={budget.spent_amount}
                target={budget.amount_limit}
                color={budget.over_budget ? 'red' : 'green'}
              />

              <p className={budget.over_budget ? 'negative' : 'muted'} style={{ fontWeight: budget.over_budget ? 700 : 400 }}>
                {budget.over_budget
                  ? `⚠️ Over budget by ${money(Math.abs(budget.remaining_amount))} (${budget.progress_percent}% used)`
                  : `${money(budget.remaining_amount)} remaining · ${budget.progress_percent}% used · ${budget.pace_label}`}
              </p>
            </article>
          ))}
        </section>
      )}

      {modalOpen && (
        <Modal title={editingBudget ? 'Edit Budget' : 'Add Budget'} onClose={() => setModalOpen(false)}>
          <form className="form" onSubmit={handleSave} noValidate>
            <label>
              Expense Category
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setError('');
                }}
                disabled={Boolean(editingBudget)}
              >
                <option value="">Select a category</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month
              <input type="month" value={selectedMonth} readOnly />
            </label>
            <label>
              Monthly Limit (JPY)
              <input
                type="number"
                min="1"
                step="1"
                value={amountLimit}
                placeholder="e.g. 25000"
                onChange={(e) => {
                  setAmountLimit(e.target.value);
                  setError('');
                }}
                required
              />
            </label>
            {error && <p role="alert" className="negative" style={{ margin: 0 }}>{error}</p>}
            <div className="form-actions">
              <button className="btn secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit">{editingBudget ? 'Save Changes' : 'Add Budget'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Budget" onClose={() => setDeleteTarget(null)}>
          <p>
            Delete the <strong>{deleteTarget.category_name}</strong> budget ({money(deleteTarget.amount_limit)}) for{' '}
            {formatMonth(selectedMonth)}?
          </p>
          <div className="form-actions">
            <button className="btn secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn primary" type="button" onClick={confirmDelete}>Delete Budget</button>
          </div>
        </Modal>
      )}
    </>
  );
}
