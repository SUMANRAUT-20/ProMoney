
import { useState } from 'react';
import { CalendarDays, Pencil, Plus, Wallet } from 'lucide-react';
import {
  EmptyState,
  Modal,
  PageHeading,
  ProgressBar,
} from '../../components/ui';

const formatYen = (value) =>
  `¥${Number(value || 0).toLocaleString('ja-JP')}`;

const currentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatMonth = (month) => {
  const [year, monthNumber] = month.split('-');
  return `${year} / ${monthNumber}`;
};

export default function BudgetsView() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [budgets, setBudgets] = useState([]);
  const [categories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [amountLimit, setAmountLimit] = useState('');
  const [error, setError] = useState('');

  // ROS-01 uses local UI state only.
  // ROS-02 will load actual categories, budgets, and spending from the API.
  const monthlyBudgets = budgets.filter(
    (budget) => budget.budget_month === selectedMonth
  );

  const totalLimit = monthlyBudgets.reduce(
    (sum, budget) => sum + budget.amount_limit,
    0
  );

  const totalSpent = monthlyBudgets.reduce(
    (sum, budget) => sum + budget.spent_amount,
    0
  );

  const remaining = totalLimit - totalSpent;

  const openAddModal = () => {
    setEditingBudget(null);
    setCategoryId('');
    setAmountLimit('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (budget) => {
    setEditingBudget(budget);
    setCategoryId(String(budget.category_id));
    setAmountLimit(String(budget.amount_limit));
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError('');
  };

  const handleSave = (event) => {
    event.preventDefault();

    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    if (!/^[1-9]\d*$/.test(amountLimit)) {
      setError('Enter a positive whole-yen amount.');
      return;
    }

    const limit = Number(amountLimit);

    if (!Number.isSafeInteger(limit)) {
      setError('The amount is too large.');
      return;
    }

    const category = categories.find(
      (item) => String(item.id) === categoryId
    );

    if (!category) {
      setError('Please select a valid category.');
      return;
    }

    const duplicate = monthlyBudgets.some(
      (budget) =>
        String(budget.category_id) === categoryId &&
        budget.id !== editingBudget?.id
    );

    if (duplicate) {
      setError('This category already has a budget for this month.');
      return;
    }

    const spentAmount = editingBudget?.spent_amount ?? 0;
    const progressPercent =
      limit > 0 ? (spentAmount / limit) * 100 : 0;

    const nextBudget = {
      id: editingBudget?.id ?? `local-${Date.now()}`,
      category_id: category.id,
      category_name: category.name,
      budget_month: selectedMonth,
      amount_limit: limit,
      spent_amount: spentAmount,
      remaining_amount: limit - spentAmount,
      progress_percent: progressPercent,
      bar_percent: Math.min(100, progressPercent),
      over_budget: spentAmount > limit,
    };

    setBudgets((previous) => {
      if (editingBudget) {
        return previous.map((budget) =>
          budget.id === editingBudget.id ? nextBudget : budget
        );
      }

      return [...previous, nextBudget];
    });

    closeModal();
  };

  return (
    <>
      <PageHeading
        title="Monthly Budgets"
        subtitle="Set monthly JPY spending limits by category and track budget usage."
        action={
          <button
            className="btn primary"
            type="button"
            onClick={openAddModal}
            disabled={categories.length === 0}
            title={
              categories.length === 0
                ? 'Categories will be available after API integration.'
                : undefined
            }
          >
            <Plus size={17} />
            Add Budget
          </button>
        }
      />

      <section className="section-card card">
        <div className="section-title">
          <h2>Select Month</h2>
          <label className="inline-editor">
            <CalendarDays size={18} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                if (event.target.value) {
                  setSelectedMonth(event.target.value);
                }
              }}
              aria-label="Budget month"
            />
          </label>
        </div>
      </section>

      <section className="budget-overview card">
        <div>
          <span className="eyebrow">
            MONTHLY BUDGET OVERVIEW
          </span>
          <h2>{formatYen(totalSpent)} / {formatYen(totalLimit)}</h2>
          <p>
            {formatMonth(selectedMonth)} ·
            {' '}Remaining: {formatYen(remaining)}
          </p>
        </div>
        <div className="illustration-circle">
          <Wallet size={28} />
        </div>
      </section>

      {monthlyBudgets.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No budgets for this month"
          description={
            categories.length === 0
              ? 'No categories are loaded yet. Budget creation will be available when the categories API is connected in ROS-02.'
              : 'Select Add Budget to set a monthly spending limit.'
          }
        />
      ) : (
        <section className="budget-grid">
          {monthlyBudgets.map((budget) => (
            <article className="budget-card card" key={budget.id}>
              <div className="budget-top">
                <h3>{budget.category_name}</h3>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => openEditModal(budget)}
                  aria-label={`Edit ${budget.category_name} budget`}
                >
                  <Pencil size={16} />
                </button>
              </div>

              <div className="budget-figures">
                <strong>{formatYen(budget.spent_amount)}</strong>
                <span>of {formatYen(budget.amount_limit)}</span>
              </div>

              <ProgressBar
                current={budget.spent_amount}
                target={budget.amount_limit}
                color={budget.over_budget ? 'red' : 'green'}
              />

              <p>
                {budget.over_budget
                  ? `${formatYen(Math.abs(budget.remaining_amount))} over budget`
                  : `${formatYen(budget.remaining_amount)} remaining`}
                {' · '}
                {Math.round(budget.progress_percent)}% used
              </p>
            </article>
          ))}
        </section>
      )}

      <p className="support-note">
        Budget limits are spending plans, not transactions.
        This UI does not save changes to the database yet.
      </p>

      {isModalOpen && (
        <Modal
          title={editingBudget ? 'Edit Budget' : 'Add Budget'}
          onClose={closeModal}
        >
          <form className="form" onSubmit={handleSave}>
            <label>
              Category
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setError('');
                }}
                disabled={Boolean(editingBudget)}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Month
              <input
                type="month"
                value={selectedMonth}
                readOnly
              />
            </label>

            <label>
              Monthly Limit (JPY)
              <input
                type="number"
                min="1"
                step="1"
                value={amountLimit}
                onChange={(event) => {
                  setAmountLimit(event.target.value);
                  setError('');
                }}
                placeholder="Enter amount in yen"
                required
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
              <button className="btn primary" type="submit">
                {editingBudget ? 'Save Changes' : 'Add Budget'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
