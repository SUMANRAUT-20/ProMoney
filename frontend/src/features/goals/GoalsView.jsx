
import { useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  EmptyState,
  Modal,
  PageHeading,
  ProgressBar,
} from '../../components/ui';

const formatYen = (value) =>
  `¥${Number(value || 0).toLocaleString('ja-JP')}`;

const emptyGoalForm = {
  title: '',
  target_amount: '',
  saved_amount: '0',
  monthly_plan: '0',
};

const parseWholeYen = (value, allowZero = false) => {
  const text = String(value).trim();

  if (!/^\d+$/.test(text)) return null;

  const amount = Number(text);

  if (!Number.isSafeInteger(amount)) return null;
  if (allowZero ? amount < 0 : amount <= 0) return null;

  return amount;
};

const getProgress = (goal) => {
  if (goal.target_amount <= 0) return 0;

  return Math.min(
    100,
    (goal.saved_amount / goal.target_amount) * 100
  );
};

export default function GoalsView() {
  const [goals, setGoals] = useState([]);
  const [filter, setFilter] = useState('all');

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState(emptyGoalForm);
  const [goalError, setGoalError] = useState('');

  const [contributionGoal, setContributionGoal] = useState(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionError, setContributionError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalTarget = goals.reduce(
    (sum, goal) => sum + goal.target_amount,
    0
  );

  const totalSaved = goals.reduce(
    (sum, goal) => sum + goal.saved_amount,
    0
  );

  const activeGoals = goals.filter(
    (goal) => goal.saved_amount < goal.target_amount
  ).length;

  const completedGoals = goals.filter(
    (goal) => goal.saved_amount >= goal.target_amount
  ).length;

  const filteredGoals = goals.filter((goal) => {
    const completed = goal.saved_amount >= goal.target_amount;

    if (filter === 'active') return !completed;
    if (filter === 'completed') return completed;

    return true;
  });

  const updateGoalForm = (field, value) => {
    setGoalForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setGoalError('');
  };

  const openAddGoal = () => {
    setEditingGoal(null);
    setGoalForm({ ...emptyGoalForm });
    setGoalError('');
    setIsGoalModalOpen(true);
  };

  const openEditGoal = (goal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      target_amount: String(goal.target_amount),
      saved_amount: String(goal.saved_amount),
      monthly_plan: String(goal.monthly_plan),
    });
    setGoalError('');
    setIsGoalModalOpen(true);
  };

  const closeGoalModal = () => {
    setIsGoalModalOpen(false);
    setEditingGoal(null);
    setGoalError('');
  };

  const saveGoal = (event) => {
    event.preventDefault();

    const title = goalForm.title.trim();

    const targetAmount = parseWholeYen(
      goalForm.target_amount
    );

    const savedAmount = parseWholeYen(
      goalForm.saved_amount,
      true
    );

    const monthlyPlan = parseWholeYen(
      goalForm.monthly_plan,
      true
    );

    if (!title) {
      setGoalError('Please enter a goal name.');
      return;
    }

    if (title.length > 100) {
      setGoalError('Goal name must be 100 characters or fewer.');
      return;
    }

    if (targetAmount === null) {
      setGoalError(
        'Target amount must be a positive whole-yen number.'
      );
      return;
    }

    if (savedAmount === null) {
      setGoalError(
        'Saved amount must be zero or a positive whole-yen number.'
      );
      return;
    }

    if (monthlyPlan === null) {
      setGoalError(
        'Monthly plan must be zero or a positive whole-yen number.'
      );
      return;
    }

    if (savedAmount > targetAmount) {
      setGoalError(
        'Saved amount cannot exceed the target amount.'
      );
      return;
    }

    const nextGoal = {
      id: editingGoal?.id ?? crypto.randomUUID(),
      title,
      target_amount: targetAmount,
      saved_amount: savedAmount,
      monthly_plan: monthlyPlan,
    };

    setGoals((previous) => {
      if (editingGoal) {
        return previous.map((goal) =>
          goal.id === editingGoal.id ? nextGoal : goal
        );
      }

      return [...previous, nextGoal];
    });

    closeGoalModal();
  };

  const openContributionModal = (goal) => {
    setContributionGoal(goal);
    setContributionAmount('');
    setContributionError('');
  };

  const closeContributionModal = () => {
    setContributionGoal(null);
    setContributionAmount('');
    setContributionError('');
  };

  const saveContribution = (event) => {
    event.preventDefault();

    if (!contributionGoal) return;

    const amount = parseWholeYen(contributionAmount);

    if (amount === null) {
      setContributionError(
        'Please enter a positive whole-yen contribution.'
      );
      return;
    }

    const currentGoal = goals.find(
      (goal) => goal.id === contributionGoal.id
    );

    if (!currentGoal) {
      setContributionError('This goal no longer exists.');
      return;
    }

    const remaining =
      currentGoal.target_amount - currentGoal.saved_amount;

    if (remaining <= 0) {
      setContributionError(
        'This goal is already completed.'
      );
      return;
    }

    if (amount > remaining) {
      setContributionError(
        `The maximum contribution is ${formatYen(remaining)}.`
      );
      return;
    }

    setGoals((previous) =>
      previous.map((goal) =>
        goal.id === currentGoal.id
          ? {
              ...goal,
              saved_amount: goal.saved_amount + amount,
            }
          : goal
      )
    );

    closeContributionModal();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    setGoals((previous) =>
      previous.filter((goal) => goal.id !== deleteTarget.id)
    );

    setDeleteTarget(null);
  };

  return (
    <>
      <PageHeading
        title="Savings Goals"
        subtitle="Create savings targets, plan monthly savings, and track your progress in JPY."
        action={
          <button
            className="btn primary"
            type="button"
            onClick={openAddGoal}
          >
            <Plus size={17} />
            Add Goal
          </button>
        }
      />

      <section
        className="metrics-grid"
        style={{ marginBottom: 18 }}
      >
        <div className="metric card">
          <div className="metric-icon green">
            <Target size={19} />
          </div>
          <div>
            <span className="metric-label">Total target</span>
            <strong className="metric-number">
              {formatYen(totalTarget)}
            </strong>
          </div>
        </div>

        <div className="metric card">
          <div className="metric-icon">
            <Wallet size={19} />
          </div>
          <div>
            <span className="metric-label">Total saved</span>
            <strong className="metric-number">
              {formatYen(totalSaved)}
            </strong>
          </div>
        </div>

        <div className="metric card">
          <div className="metric-icon">
            <TrendingUp size={19} />
          </div>
          <div>
            <span className="metric-label">Active goals</span>
            <strong className="metric-number">
              {activeGoals}
            </strong>
          </div>
        </div>

        <div className="metric card">
          <div className="metric-icon">
            <CheckCircle2 size={19} />
          </div>
          <div>
            <span className="metric-label">Completed</span>
            <strong className="metric-number">
              {completedGoals}
            </strong>
          </div>
        </div>
      </section>

      <section className="section-card card">
        <div
          className="section-title"
          style={{ marginBottom: 12 }}
        >
          <h2>My Savings Goals</h2>
          <span className="support-note">
            {goals.length} total
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
            ['active', 'Active'],
            ['completed', 'Completed'],
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

        {filteredGoals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={
              goals.length === 0
                ? 'No savings goals yet'
                : `No ${filter} goals`
            }
            description={
              goals.length === 0
                ? 'Create your first savings goal to start tracking progress.'
                : 'Try another filter to see your savings goals.'
            }
          />
        ) : (
          <div
            className="budget-grid"
            style={{ marginTop: 8 }}
          >
            {filteredGoals.map((goal) => {
              const progress = getProgress(goal);
              const completed =
                goal.saved_amount >= goal.target_amount;

              const remaining =
                goal.target_amount - goal.saved_amount;

              return (
                <article
                  key={goal.id}
                  className="budget-card card"
                >
                  <div className="budget-top">
                    <div>
                      <h3 style={{ margin: 0 }}>
                        {goal.title}
                      </h3>

                      <p className="support-note">
                        {completed
                          ? 'Goal completed'
                          : 'Savings in progress'}
                      </p>
                    </div>

                    {completed ? (
                      <CheckCircle2
                        size={23}
                        color="#299365"
                      />
                    ) : (
                      <Coins size={23} />
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ fontSize: 19 }}>
                      {formatYen(goal.saved_amount)}
                    </strong>

                    <span className="support-note">
                      {Math.round(progress)}%
                    </span>
                  </div>

                  <ProgressBar
                    current={goal.saved_amount}
                    target={goal.target_amount}
                    color="green"
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginTop: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="support-note">
                      Target: {formatYen(goal.target_amount)}
                    </span>

                    <span className="support-note">
                      Remaining: {formatYen(remaining)}
                    </span>
                  </div>

                  <p
                    className="support-note"
                    style={{ marginTop: 10 }}
                  >
                    Monthly plan:{' '}
                    {formatYen(goal.monthly_plan)}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 16,
                    }}
                  >
                    {!completed && (
                      <button
                        className="btn primary"
                        type="button"
                        onClick={() =>
                          openContributionModal(goal)
                        }
                      >
                        <Plus size={15} />
                        Add Savings
                      </button>
                    )}

                    <button
                      className="btn"
                      type="button"
                      onClick={() => openEditGoal(goal)}
                    >
                      <Pencil size={15} />
                      Edit
                    </button>

                    <button
                      className="btn"
                      type="button"
                      onClick={() => setDeleteTarget(goal)}
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
        Savings goals are stored temporarily in page memory.
        Refreshing clears them. Adding savings does not
        automatically change account balances or create transactions.
      </p>

      {isGoalModalOpen && (
        <Modal
          title={editingGoal ? 'Edit Savings Goal' : 'Add Savings Goal'}
          onClose={closeGoalModal}
        >
          <form className="form" onSubmit={saveGoal}>
            <label>
              Goal Name
              <input
                type="text"
                value={goalForm.title}
                onChange={(event) =>
                  updateGoalForm('title', event.target.value)
                }
                placeholder="e.g. Buy a Laptop"
                maxLength={100}
                required
              />
            </label>

            <label>
              Target Amount (JPY)
              <input
                type="number"
                min="1"
                step="1"
                value={goalForm.target_amount}
                onChange={(event) =>
                  updateGoalForm(
                    'target_amount',
                    event.target.value
                  )
                }
                placeholder="e.g. 150000"
                required
              />
            </label>

            <label>
              Already Saved (JPY)
              <input
                type="number"
                min="0"
                step="1"
                value={goalForm.saved_amount}
                onChange={(event) =>
                  updateGoalForm(
                    'saved_amount',
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Monthly Savings Plan (JPY)
              <input
                type="number"
                min="0"
                step="1"
                value={goalForm.monthly_plan}
                onChange={(event) =>
                  updateGoalForm(
                    'monthly_plan',
                    event.target.value
                  )
                }
                required
              />
            </label>

            {goalError && (
              <p className="negative" role="alert">
                {goalError}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn"
                type="button"
                onClick={closeGoalModal}
              >
                Cancel
              </button>

              <button
                className="btn primary"
                type="submit"
              >
                {editingGoal ? 'Save Changes' : 'Add Goal'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {contributionGoal && (
        <Modal
          title="Add Savings"
          onClose={closeContributionModal}
        >
          <form
            className="form"
            onSubmit={saveContribution}
          >
            <p>
              Add savings toward{' '}
              <strong>{contributionGoal.title}</strong>.
            </p>

            <p className="support-note">
              Remaining:{' '}
              {formatYen(
                contributionGoal.target_amount -
                  contributionGoal.saved_amount
              )}
            </p>

            <label>
              Contribution Amount (JPY)
              <input
                type="number"
                min="1"
                step="1"
                value={contributionAmount}
                onChange={(event) => {
                  setContributionAmount(event.target.value);
                  setContributionError('');
                }}
                placeholder="Enter amount in yen"
                required
              />
            </label>

            {contributionError && (
              <p className="negative" role="alert">
                {contributionError}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn"
                type="button"
                onClick={closeContributionModal}
              >
                Cancel
              </button>

              <button
                className="btn primary"
                type="submit"
              >
                Add Savings
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete Savings Goal"
          onClose={() => setDeleteTarget(null)}
        >
          <p>
            Are you sure you want to delete{' '}
            <strong>{deleteTarget.title}</strong>?
          </p>

          <p className="support-note">
            This goal and its temporary saved amount
            will be removed from the current session.
          </p>

          <div className="form-actions">
            <button
              className="btn"
              type="button"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>

            <button
              className="btn primary"
              type="button"
              onClick={confirmDelete}
            >
              Delete Goal
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
