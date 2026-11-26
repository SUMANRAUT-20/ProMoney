import { useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Bot, CheckCircle2, ReceiptText, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Amount, EmptyState } from '../../components/ui';
import { formatDate, money } from '../../utils/formatters';

function Bills({ bills }) {
  const navigate = useNavigate();

  return (
    <section className="home-attention-section" aria-label="Bills to pay">
      <div className="section-title">
        <h3>Bills to Pay</h3>
        <button className="text-action" type="button" onClick={() => navigate('/bills')}>
          Manage Bills
        </button>
      </div>

      {bills.items.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No unpaid bills"
          description="Scheduled rent, utilities, and subscriptions appear here."
          action={
            <button className="btn secondary compact" type="button" onClick={() => navigate('/bills')}>
              Go to Bills
            </button>
          }
        />
      ) : (
        <div className="home-bill-list">
          {bills.items.slice(0, 5).map((bill) => (
            <div key={bill.id} className={`home-bill-item ${bill.isOverdue ? 'overdue' : ''}`}>
              <div className="home-bill-description">
                <ReceiptText size={17} color={bill.isOverdue ? 'var(--red)' : 'var(--green)'} />
                <div>
                  <strong>{bill.name}</strong>
                  <div className="muted small">
                    {bill.category} · {formatDate(bill.due_date)}
                  </div>
                </div>
              </div>
              <div className="home-bill-amount">
                <strong>{money(bill.amount)}</strong>
                <span className="home-bill-due-tag">{bill.dueLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="home-bills-footer">
        <span className="muted">Total still due this month</span>
        <strong>{money(bills.totalStillDueThisMonth)}</strong>
      </div>
    </section>
  );
}

function Warnings({ warnings, preferences }) {
  const navigate = useNavigate();

  return (
    <section className="home-attention-section home-warning-section" aria-label="Warnings strip">
      <div className="section-title">
        <h3>Warnings &amp; Pace Signals</h3>
        <button className="text-action" type="button" onClick={() => navigate('/settings')}>
          Thresholds ({preferences.budget_warning_percent ?? 20}% · {preferences.bill_reminder_days ?? 3}d)
        </button>
      </div>

      <div className="home-warnings-strip">
        {warnings.length === 0 ? (
          <div className="home-warning-item">
            <CheckCircle2 size={17} color="var(--green)" />
            <span>All clear — budgets, spending pace, and upcoming bills are on track.</span>
          </div>
        ) : (
          warnings.map((w, idx) => (
            <div key={`${w.kind}-${idx}`} className={`home-warning-item ${w.severity || 'warning'}`} role="alert">
              <AlertTriangle size={17} />
              <span>{w.title}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function NeedsAttention({ bills, warnings, preferences }) {
  return (
    <section className="section-card card home-attention" aria-labelledby="home-attention-title">
      <h2 id="home-attention-title">Needs Attention</h2>
      <Bills bills={bills} />
      <Warnings warnings={warnings} preferences={preferences} />
    </section>
  );
}

function GoalProgressRing({ goal }) {
  const size = 84;
  const strokeWidth = 7;
  const radius = 34;
  const circumference = 213.6;
  const dashOffset = goal.isZeroTarget
    ? circumference
    : circumference - (goal.bar_percent / 100) * circumference;

  return (
    <div className="home-goal-ring-card">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${goal.title}: ${goal.ringLabel}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {!goal.isZeroTarget && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--green)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={goal.isZeroTarget ? '9.5' : '13'}
          fontWeight="700"
          fill="var(--text)"
        >
          {goal.ringLabel}
        </text>
      </svg>
      <strong style={{ fontSize: 13 }}>{goal.title}</strong>
      <span className="muted small">
        {money(goal.saved_amount)} / {money(goal.target_amount)}
      </span>
    </div>
  );
}

export function SavingsGoals({ goals }) {
  const navigate = useNavigate();

  return (
    <section className="section-card card home-goals" aria-label="Savings goals progress rings">
      <div className="section-title">
        <h2>Savings Goals</h2>
        <button className="text-action" type="button" onClick={() => navigate('/goals')}>
          View Goals
        </button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No savings goals yet"
          description="Set a JPY target to track progress rings here."
          action={
            <button className="btn secondary compact" type="button" onClick={() => navigate('/goals')}>
              Add Goal
            </button>
          }
        />
      ) : (
        <div className="home-goals-rings-grid">
          {goals.slice(0, 4).map((goal) => (
            <GoalProgressRing key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </section>
  );
}

export function RecentTransactions({ transactions }) {
  const navigate = useNavigate();

  return (
    <section className="section-card card home-recent" aria-label="Recent transactions">
      <div className="section-title">
        <h2>Recent Transactions</h2>
        <button className="text-action" type="button" onClick={() => navigate('/transactions')}>
          See All
        </button>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No transactions yet"
          description="Recorded income and expenses appear here with their titles."
          action={
            <button className="btn primary compact" type="button" onClick={() => navigate('/transactions')}>
              Add Transaction
            </button>
          }
        />
      ) : (
        <div className="recent-list">
          {transactions.map((tx) => (
            <div key={tx.id} className="recent-row">
              <div className={`transaction-dot ${tx.kind}`}>
                {tx.kind === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>
              <div>
                <strong>{tx.displayTitle}</strong>
                <small>
                  {tx.categoryName} · {formatDate(tx.transaction_date)}
                </small>
              </div>
              <div className="recent-amount">
                <Amount amount={tx.amount} type={tx.kind} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function NidhiAlert({ alertText }) {
  const navigate = useNavigate();
  const [quickQuestion, setQuickQuestion] = useState('');

  const handleQuickAsk = (event) => {
    event.preventDefault();
    const q = quickQuestion.trim();
    if (!q) {
      navigate('/labo');
      return;
    }
    navigate(`/labo?q=${encodeURIComponent(q)}`);
  };

  return (
    <section className="section-card card home-nidhi" aria-label="Nidhi alert and quick ask">
      <div className="home-labo-bar">
        <div className="home-labo-alert-line">
          <Bot size={20} color="var(--green)" style={{ flexShrink: 0 }} />
          <div>
            <strong>Nidhi:</strong> <span>{alertText}</span>
          </div>
        </div>

        <form className="labo-input-row" onSubmit={handleQuickAsk}>
          <input
            type="text"
            value={quickQuestion}
            onChange={(e) => setQuickQuestion(e.target.value)}
            placeholder="Ask Nidhi… e.g. How much can I safely spend per day?"
            maxLength={500}
            aria-label="Quick ask Nidhi"
          />
          <button type="submit" className="btn primary compact">
            <Send size={14} /> Ask Nidhi
          </button>
        </form>
      </div>
    </section>
  );
}
