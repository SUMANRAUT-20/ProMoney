import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  ReceiptText,
  Send,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Amount, EmptyState, PageHeading } from '../../components/ui';
import { currentMonthISO, formatDate, formatMonth, money, todayISO } from '../../utils/formatters';
import { buildHomeSummary } from '../../utils/financeMath';
import './home.css';

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

/**
 * Home Screen (Layer 2) — Built to Feature Spec "Home Screen Specification"
 * Every figure is computed by `buildHomeSummary` in `financeMath` (Constitution A3).
 * Tapping headline cards reveals their engine breakdown (Constitution P2).
 */
export default function DashboardView() {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, bills, goals, categories, preferences } = useFinance();

  const [showMoneyProof, setShowMoneyProof] = useState(false);
  const [showSafeProof, setShowSafeProof] = useState(false);
  const [quickQuestion, setQuickQuestion] = useState('');

  const today = todayISO();
  const month = currentMonthISO();
  const home = buildHomeSummary({
    accounts,
    transactions,
    budgets,
    bills,
    goals,
    categories,
    preferences,
    today,
    month,
  });

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
    <div className="home-stack">
      <PageHeading
        title="Home"
        subtitle={`Your daily JPY snapshot for ${formatMonth(month)} — tap any headline card to see its breakdown.`}
        action={
          <button className="btn primary" type="button" onClick={() => navigate('/transactions')}>
            <Plus size={16} /> Record Transaction
          </button>
        }
      />

      {/* 1. Money you hold & 2. Safe to spend today */}
      <div className="home-top-grid">
        <section
          className="section-card card home-tap-card"
          style={{ marginBottom: 0 }}
          aria-label="Money you hold"
          onClick={() => setShowMoneyProof((v) => !v)}
        >
          <div className="home-card-head">
            <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Wallet size={15} color="var(--green)" /> MONEY YOU HOLD (SPENDABLE)
            </span>
            <button
              type="button"
              className="icon-button"
              aria-expanded={showMoneyProof}
              aria-label="Toggle Money you hold breakdown"
              onClick={(e) => {
                e.stopPropagation();
                setShowMoneyProof((v) => !v);
              }}
            >
              {showMoneyProof ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <div className="home-big-amount">{money(home.moneyYouHold.spendable)}</div>

          <div className="home-sublines">
            <span>
              Your real money: <strong>{money(home.moneyYouHold.realMoney)}</strong>
            </span>
            <span>
              To pay back: <strong>{money(home.moneyYouHold.toPayBack)}</strong>
            </span>
          </div>

          {showMoneyProof && (
            <div className="home-proof-panel" onClick={(e) => e.stopPropagation()}>
              <strong>Engine Breakdown (Cash + Bank + Digital)</strong>
              {home.moneyYouHold.accountBreakdown.length === 0 ? (
                <span className="muted">No accounts added yet — add one on My Accounts.</span>
              ) : (
                home.moneyYouHold.accountBreakdown.map((acc) => (
                  <div key={acc.id} className="home-proof-row">
                    <span>
                      {acc.name} <small className="muted">({acc.kind})</small>
                    </span>
                    <strong>{acc.cardCredit ? `${money(acc.cardCredit)} credit` : money(acc.liveBalance)}</strong>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section
          className="section-card card home-tap-card"
          style={{ marginBottom: 0 }}
          aria-label="Safe to spend today"
          onClick={() => setShowSafeProof((v) => !v)}
        >
          <div className="home-card-head">
            <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CalendarClock size={15} color="var(--green)" /> SAFE TO SPEND TODAY
            </span>
            <button
              type="button"
              className="icon-button"
              aria-expanded={showSafeProof}
              aria-label="Toggle Safe to spend formula breakdown"
              onClick={(e) => {
                e.stopPropagation();
                setShowSafeProof((v) => !v);
              }}
            >
              {showSafeProof ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <div className="home-big-amount" style={{ color: home.safeToSpend.overPlan ? 'var(--red)' : 'var(--text)' }}>
            {money(home.safeToSpend.dailySafe)} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>/ day</span>
          </div>

          <div className="home-sublines">
            <span>
              Safe this month: <strong>{money(home.safeToSpend.availablePool)}</strong>
            </span>
            <span>
              Days left: <strong>{home.safeToSpend.daysLeft}d</strong>
            </span>
          </div>

          {showSafeProof && (
            <div className="home-proof-panel" onClick={(e) => e.stopPropagation()}>
              <strong>Formula: (Money + Expected Income − Bills − Goal Plan − Buffer) ÷ Days Left</strong>
              <div className="home-proof-row">
                <span>Spendable balance</span>
                <strong>{money(home.safeToSpend.spendable)}</strong>
              </div>
              <div className="home-proof-row">
                <span>+ Income still expected</span>
                <strong>{money(home.safeToSpend.incomeStillExpected)}</strong>
              </div>
              <div className="home-proof-row">
                <span>− Bills still due this month</span>
                <strong>{money(home.safeToSpend.billsStillDue)}</strong>
              </div>
              <div className="home-proof-row">
                <span>− Goal saving plan</span>
                <strong>{money(home.safeToSpend.goalSavingPlan)}</strong>
              </div>
              <div className="home-proof-row">
                <span>− Minimum buffer</span>
                <strong>{money(home.safeToSpend.buffer)}</strong>
              </div>
              <div className="home-proof-row">
                <span>÷ {home.safeToSpend.daysLeft} days left in month</span>
                <strong>{money(home.safeToSpend.dailySafe)} / day</strong>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 3. Bills to pay (overdue pinned on top in red + month footer) */}
      <section className="section-card card" style={{ marginBottom: 0 }} aria-label="Bills to pay">
        <div className="section-title">
          <h2>Bills to Pay</h2>
          <button className="text-action" type="button" onClick={() => navigate('/bills')}>
            Manage Bills
          </button>
        </div>

        {home.billsToPay.items.length === 0 ? (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {home.billsToPay.items.slice(0, 5).map((bill) => (
              <div key={bill.id} className={`home-bill-item ${bill.isOverdue ? 'overdue' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ReceiptText size={17} color={bill.isOverdue ? 'var(--red)' : 'var(--green)'} />
                  <div>
                    <strong>{bill.name}</strong>
                    <div className="muted small">
                      {bill.category} · {formatDate(bill.due_date)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ display: 'block' }}>{money(bill.amount)}</strong>
                  <span className="home-bill-due-tag">{bill.dueLabel}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="home-bills-footer">
          <span className="muted">Total still due this month</span>
          <strong>{money(home.billsToPay.totalStillDueThisMonth)}</strong>
        </div>
      </section>

      {/* 4. Warnings strip (ranked engine alerts) */}
      <section className="section-card card" style={{ marginBottom: 0 }} aria-label="Warnings strip">
        <div className="section-title">
          <h2>Warnings &amp; Pace Signals</h2>
          <button className="text-action" type="button" onClick={() => navigate('/settings')}>
            Thresholds ({preferences.budget_warning_percent ?? 20}% · {preferences.bill_reminder_days ?? 3}d)
          </button>
        </div>

        <div className="home-warnings-strip">
          {home.warnings.length === 0 ? (
            <div className="home-warning-item">
              <CheckCircle2 size={17} color="var(--green)" />
              <span>All clear — budgets, spending pace, and upcoming bills are on track.</span>
            </div>
          ) : (
            home.warnings.map((w, idx) => (
              <div key={`${w.kind}-${idx}`} className={`home-warning-item ${w.severity || 'warning'}`} role="alert">
                <AlertTriangle size={17} />
                <span>{w.title}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 5. Goals row (Progress rings with H3 ¥0-target guard) */}
      <section className="section-card card" style={{ marginBottom: 0 }} aria-label="Savings goals progress rings">
        <div className="section-title">
          <h2>Savings Goals</h2>
          <button className="text-action" type="button" onClick={() => navigate('/goals')}>
            View Goals
          </button>
        </div>

        {home.goalRings.length === 0 ? (
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
            {home.goalRings.slice(0, 4).map((goal) => (
              <GoalProgressRing key={goal.id} goal={goal} />
            ))}
          </div>
        )}
      </section>

      {/* 6. Recent 5 transactions WITH TITLES shown */}
      <section className="section-card card" style={{ marginBottom: 0 }} aria-label="Recent transactions">
        <div className="section-title">
          <h2>Recent Transactions</h2>
          <button className="text-action" type="button" onClick={() => navigate('/transactions')}>
            See All
          </button>
        </div>

        {home.recentTransactions.length === 0 ? (
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
            {home.recentTransactions.map((tx) => (
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

      {/* 7. LA-BO one-line alert card + quick-ask box */}
      <section className="section-card card" style={{ marginBottom: 0 }} aria-label="Nidhi alert and quick ask">
        <div className="home-labo-bar">
          <div className="home-labo-alert-line">
            <Bot size={20} color="var(--green)" style={{ flexShrink: 0 }} />
            <div>
              <strong>Nidhi:</strong> <span>{home.laboAlertText}</span>
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
    </div>
  );
}
