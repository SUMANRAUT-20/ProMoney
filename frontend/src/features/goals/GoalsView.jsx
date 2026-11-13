import { useState } from 'react';
import { CheckCircle2, Coins, Pencil, Plus, Target, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { EmptyState, Metric, Modal, PageHeading, ProgressBar } from '../../components/ui';
import {
  addMonthsISO,
  formatDate,
  formatGoalProgress,
  goalPercent,
  isValidISODate,
  money,
  parseWholeYen,
  sum,
  todayISO,
} from '../../utils/formatters';
import { calculateGoalProgress, getGoalForecast, getMonthlySavingPace } from '../../utils/financeMath';

function GoalForecastBlock({ goal, monthlyPace, today }) {
  const forecast = getGoalForecast(goal, monthlyPace, today);
  const pct = goalPercent(goal);
  const startY = 30 - Math.round(((pct ?? 0) / 100) * 22);

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <svg viewBox="0 0 220 36" width="100%" height="36" role="img" aria-label="Goal growth forecast line">
        <line x1="8" y1="8" x2="212" y2="8" stroke="var(--border)" strokeDasharray="4 3" />
        {forecast.expectedDate || forecast.completed ? (
          <>
            <polyline
              fill="none"
              stroke="var(--green)"
              strokeWidth="2.2"
              points={`8,${startY} 212,8`}
            />
            <circle cx="8" cy={startY} r="3" fill="var(--green)" />
            <circle cx="212" cy="8" r="3" fill="var(--green)" />
          </>
        ) : (
          <line x1="8" y1={startY} x2="212" y2={startY} stroke="var(--red)" strokeWidth="2" strokeDasharray="3 3" />
        )}
      </svg>
      <p className="small" style={{ margin: '4px 0 0', color: forecast.completed || forecast.onTrack ? 'var(--green-dark)' : 'var(--red)' }}>
        {forecast.label === 'Set a target'
          ? 'Set a target to calculate progress and completion date.'
          : forecast.completed
            ? 'Completed! Savings target reached.'
            : forecast.expectedDate
              ? `Growth forecast: est. ${formatDate(forecast.expectedDate)} (${forecast.monthsNeeded} mo · ${forecast.onTrack ? 'On track' : 'After deadline'})`
              : `Growth forecast: ${forecast.label} — increase monthly savings to project completion.`}
      </p>
    </div>
  );
}

export default function GoalsView() {
  const { goals, addGoal, editGoal, contributeGoal, removeGoal, transactions } = useFinance();
  const today = todayISO();
  const defaultDeadline = addMonthsISO(today, 6);

  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [form, setForm] = useState({ title: '', target_amount: '', saved_amount: '0', target_date: defaultDeadline, monthly_plan: '10000' });
  const [error, setError] = useState('');

  const [contribGoal, setContribGoal] = useState(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribError, setContribError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const totalTarget = sum(goals, 'target_amount');
  const totalSaved = sum(goals, 'saved_amount');
  const monthlyPace = getMonthlySavingPace(transactions);
  const completedCount = goals.filter((g) => calculateGoalProgress(g).completed).length;

  const filteredGoals = goals.filter((g) => {
    const done = calculateGoalProgress(g).completed;
    if (filter === 'active') return !done;
    if (filter === 'completed') return done;
    return true;
  });

  const openAdd = () => {
    setEditingGoal(null);
    setForm({ title: '', target_amount: '', saved_amount: '0', target_date: defaultDeadline, monthly_plan: '10000' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (goal) => {
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      target_amount: String(goal.target_amount),
      saved_amount: String(goal.saved_amount),
      target_date: goal.target_date || defaultDeadline,
      monthly_plan: String(goal.monthly_plan ?? 0),
    });
    setError('');
    setModalOpen(true);
  };

  const saveGoal = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const target = parseWholeYen(form.target_amount);
    const saved = parseWholeYen(form.saved_amount, { allowZero: true });
    const plan = parseWholeYen(form.monthly_plan, { allowZero: true });
    if (!title || title.length > 80) return setError('Enter a goal name (1–80 characters).');
    if (target === null) return setError('Target amount must be a whole number greater than ¥0.');
    if (saved === null) return setError('Current saved amount must be ¥0 or a positive whole number.');
    if (saved > target) return setError('Current saved amount cannot exceed target amount.');
    if (!isValidISODate(form.target_date)) return setError('Select a valid deadline date (YYYY-MM-DD).');
    if (plan === null) return setError('Monthly saving plan must be ¥0 or a positive whole number.');

    const payload = {
      title,
      target_amount: target,
      saved_amount: saved,
      target_date: form.target_date,
      monthly_plan: plan,
    };
    try {
      if (editingGoal) await editGoal(editingGoal.id, payload);
      else await addGoal(payload);
      setModalOpen(false);
    } catch (err) {
      setError(err.message || 'Could not save goal.');
    }
  };

  const saveContribution = async (event) => {
    event.preventDefault();
    if (!contribGoal) return;
    const amt = parseWholeYen(contribAmount);
    const remaining = Math.max(0, contribGoal.target_amount - contribGoal.saved_amount);
    if (amt === null) return setContribError('Enter a whole-yen amount greater than ¥0.');
    if (amt > remaining) return setContribError(`Maximum remaining amount is ${money(remaining)}.`);
    try {
      await contributeGoal(contribGoal.id, amt);
      setContribGoal(null);
    } catch (err) {
      setContribError(err.message || 'Could not add savings.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeGoal(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message || 'Could not delete goal.');
    }
  };

  return (
    <>
      <PageHeading
        title="Savings Goals"
        subtitle="Track JPY savings targets, deadlines, and real-time completion forecasts."
        action={
          <button className="btn primary" type="button" onClick={openAdd}>
            <Plus size={16} /> Add Goal
          </button>
        }
      />

      <section className="dashboard-metrics" style={{ marginBottom: 16 }}>
        <Metric icon={Target} label="Total target" value={money(totalTarget)} small={`${goals.length} goals`} />
        <Metric icon={Wallet} label="Total saved" value={money(totalSaved)} small="Across all goals" />
        <Metric icon={TrendingUp} label="Monthly saving pace" value={`${money(monthlyPace)}/mo`} small="Avg income − expenses" />
        <Metric icon={CheckCircle2} label="Completed goals" value={`${completedCount} / ${goals.length}`} small="Targets reached" />
      </section>

      <section className="section-card card">
        <div className="section-toolbar" style={{ flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>My Savings Goals</h2>
          <div className="segmented">
            {[
              ['all', 'All'],
              ['active', 'Active'],
              ['completed', 'Completed'],
            ].map(([val, label]) => (
              <button key={val} type="button" className={filter === val ? 'selected' : ''} onClick={() => setFilter(val)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredGoals.length === 0 ? (
          <EmptyState
            icon="🎯"
            title={goals.length === 0 ? 'No savings goals yet' : `No ${filter} goals`}
            description={goals.length === 0 ? 'Create a JPY target and deadline to forecast your completion date.' : 'Switch tabs or create another savings goal.'}
            action={
              goals.length === 0 ? (
                <button className="btn primary" type="button" onClick={openAdd}>
                  <Plus size={15} /> Create First Goal
                </button>
              ) : (
                <button className="btn secondary" type="button" onClick={() => setFilter('all')}>
                  Show All Goals
                </button>
              )
            }
          />
        ) : (
          <div className="budget-grid" style={{ marginTop: 8 }}>
            {filteredGoals.map((goal) => {
              const prog = calculateGoalProgress(goal);
              const completed = prog.completed;
              const remaining = prog.remaining_amount;
              return (
                <article key={goal.id} className="budget-card card">
                  <div className="budget-top">
                    <div>
                      <h3>{goal.title}</h3>
                      <span className="muted small">
                        Deadline: {formatDate(goal.target_date)} · Plan: {money(goal.monthly_plan || 0)}/mo
                      </span>
                    </div>
                    {completed ? <CheckCircle2 size={20} color="var(--green)" /> : <Coins size={20} color="var(--muted)" />}
                  </div>
                  <div className="budget-figures">
                    <strong>{money(goal.saved_amount)}</strong>
                    <span>of {money(goal.target_amount)} ({formatGoalProgress(goal)})</span>
                  </div>
                  <ProgressBar current={goal.saved_amount} target={goal.target_amount} color={completed ? 'complete' : 'green'} />
                  <p className="muted">Remaining: {money(remaining)}</p>
                  <GoalForecastBlock goal={goal} monthlyPace={monthlyPace} today={today} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    {!completed && goal.target_amount > 0 && (
                      <button className="btn primary compact" type="button" onClick={() => { setContribGoal(goal); setContribAmount(''); setContribError(''); }}>
                        <Plus size={14} /> Add Savings
                      </button>
                    )}
                    <button className="btn secondary compact" type="button" onClick={() => openEdit(goal)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="btn secondary compact" type="button" onClick={() => setDeleteTarget(goal)} aria-label={`Delete ${goal.title}`}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {modalOpen && (
        <Modal title={editingGoal ? 'Edit Savings Goal' : 'Add Savings Goal'} onClose={() => setModalOpen(false)}>
          <form className="form" onSubmit={saveGoal} noValidate>
            <label>
              Goal Name
              <input type="text" value={form.title} maxLength={80} placeholder="e.g. Graduation Laptop Fund" onChange={(e) => { setForm({ ...form, title: e.target.value }); setError(''); }} required />
            </label>
            <div className="form-row">
              <label>
                Target Amount (JPY)
                <input type="number" min="1" step="1" value={form.target_amount} placeholder="e.g. 180000" onChange={(e) => { setForm({ ...form, target_amount: e.target.value }); setError(''); }} required />
              </label>
              <label>
                Current Saved (JPY)
                <input type="number" min="0" step="1" value={form.saved_amount} onChange={(e) => { setForm({ ...form, saved_amount: e.target.value }); setError(''); }} required />
              </label>
            </div>
            <div className="form-row">
              <label>
                Deadline
                <input type="date" value={form.target_date} onChange={(e) => { setForm({ ...form, target_date: e.target.value }); setError(''); }} required />
              </label>
              <label>
                Monthly Plan (JPY)
                <input type="number" min="0" step="1" value={form.monthly_plan} onChange={(e) => { setForm({ ...form, monthly_plan: e.target.value }); setError(''); }} required />
              </label>
            </div>
            {error && <p className="negative" role="alert" style={{ margin: 0 }}>{error}</p>}
            <div className="form-actions">
              <button className="btn secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit">{editingGoal ? 'Save Changes' : 'Add Goal'}</button>
            </div>
          </form>
        </Modal>
      )}

      {contribGoal && (
        <Modal title={`Add Savings · ${contribGoal.title}`} onClose={() => setContribGoal(null)}>
          <form className="form" onSubmit={saveContribution} noValidate>
            <p className="muted" style={{ margin: 0 }}>Remaining toward target: <strong>{money(contribGoal.target_amount - contribGoal.saved_amount)}</strong></p>
            <label>
              Contribution Amount (JPY)
              <input type="number" min="1" step="1" value={contribAmount} placeholder="e.g. 15000" onChange={(e) => { setContribAmount(e.target.value); setContribError(''); }} required />
            </label>
            {contribError && <p className="negative" role="alert" style={{ margin: 0 }}>{contribError}</p>}
            <div className="form-actions">
              <button className="btn secondary" type="button" onClick={() => setContribGoal(null)}>Cancel</button>
              <button className="btn primary" type="submit">Add Savings</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Savings Goal" onClose={() => setDeleteTarget(null)}>
          <p>Delete <strong>{deleteTarget.title}</strong> ({money(deleteTarget.saved_amount)} saved)?</p>
          <div className="form-actions">
            <button className="btn secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn primary" type="button" onClick={confirmDelete}>Delete Goal</button>
          </div>
        </Modal>
      )}
    </>
  );
}
