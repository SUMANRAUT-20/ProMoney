import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Flame,
  Percent,
  Plus,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Amount, EmptyState, Metric, PageHeading, ProgressBar } from '../../components/ui';
import { currentMonthISO, daysBetweenISO, formatDate, formatMonth, goalPercent, money, todayISO } from '../../utils/formatters';
import {
  getAccountTotals,
  getBalanceProjection,
  getBudgetStatus,
  getCategoryBreakdown,
  getHealthScore,
  getMonthlySummary,
  getSafeToSpend,
} from '../../utils/financeMath';

export default function DashboardView() {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, bills, goals, categories } = useFinance();

  const today = todayISO();
  const month = currentMonthISO();
  const accountTotals = getAccountTotals(accounts, transactions);
  const summary = getMonthlySummary(transactions, month);

  const monthlyBudgets = budgets
    .filter((b) => String(b.budget_month || '').slice(0, 7) === month)
    .map((b) => getBudgetStatus(b, transactions));

  const health = getHealthScore({
    monthIncome: summary.income,
    monthExpense: summary.expense,
    monthlyBudgets,
    bills,
    today,
  });

  const safe = getSafeToSpend({ monthIncome: summary.income, bills, goals, today });
  const projection = getBalanceProjection({
    netBalance: accountTotals.net,
    monthExpense: summary.expense,
    today,
  });

  const breakdown = getCategoryBreakdown(transactions, month, categories);
  const topCategory = breakdown.items[0] || null;

  const monthExpensesList = transactions.filter(
    (t) => t.kind === 'expense' && String(t.transaction_date || '').slice(0, 7) === month,
  );
  const biggestExpense = monthExpensesList.reduce(
    (max, tx) => (!max || Number(tx.amount) > Number(max.amount) ? tx : max),
    null,
  );
  const savingsRatePct = summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : 0;

  const upcoming7dBills = bills
    .filter((b) => {
      if (b.is_paid) return false;
      const diff = daysBetweenISO(today, b.due_date);
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const overdueBillsCount = bills.filter((b) => !b.is_paid && b.due_date < today).length;
  const recentTx = [...transactions]
    .sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)))
    .slice(0, 5);

  const barScale = Math.max(summary.income, summary.expense, 1);

  return (
    <>
      <PageHeading
        title="Financial Overview"
        subtitle={`Live JPY status, account balances, and ${formatMonth(month)} cash-flow health.`}
        action={
          <button className="btn primary" type="button" onClick={() => navigate('/transactions')}>
            <Plus size={16} /> Record Transaction
          </button>
        }
      />

      <div
        className="status-banner"
        role={projection.goesNegative ? 'alert' : 'status'}
        style={projection.goesNegative ? { background: '#fdecec', borderColor: '#f3c2c2' } : undefined}
      >
        {projection.goesNegative ? (
          <AlertTriangle size={18} color="var(--red)" />
        ) : (
          <CheckCircle2 size={18} color="var(--green)" />
        )}
        <div>
          <strong style={projection.goesNegative ? { color: 'var(--red)' } : undefined}>
            {projection.goesNegative
              ? `Balance Alert: Projected month-end balance is ${money(projection.projectedEndBalance)}`
              : `Projected Month-End Balance: ${money(projection.projectedEndBalance)}`}
          </strong>
          <span>
            {projection.goesNegative
              ? `Warning before month-end: at your current spending pace (${money(projection.dailyPace)}/day), your total balance will drop below ¥0. Reduce daily spending to stay positive.`
              : `At your current ${formatMonth(month)} spending pace (${money(projection.dailyPace)}/day), your balance stays positive through month-end.`}
          </span>
        </div>
      </div>

      <section className="dashboard-metrics" aria-label="Primary financial metrics">
        <Metric
          icon={Wallet}
          label="Total balance (accounts)"
          value={money(accountTotals.net)}
          small={`Hold ${money(accountTotals.held)} · Owe ${money(accountTotals.owed)}`}
        />
        <Metric
          icon={ArrowDownLeft}
          label={`Income (${formatMonth(month)})`}
          value={money(summary.income)}
          small="This month's inflows"
        />
        <Metric
          icon={ArrowUpRight}
          label={`Expenses (${formatMonth(month)})`}
          value={money(summary.expense)}
          small={`Net ${money(summary.net)}`}
        />
        <Metric
          icon={CalendarClock}
          label="Today's Safe-to-Spend"
          value={`${money(safe.dailySafe)} / day`}
          small={`(${money(summary.income)} − ${money(safe.billsStillDue)} bills − ${money(safe.goalSavingPlan)} goals) ÷ ${safe.daysLeft}d`}
        />
      </section>

      <section className="section-card card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180 }}>
            <span className="eyebrow">FINANCIAL HEALTH SCORE</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 8px' }}>
              <ShieldCheck size={24} color="var(--green)" />
              <strong style={{ fontSize: 30, letterSpacing: '-0.8px' }}>{health.score}</strong>
              <span className="muted">/ 100</span>
            </div>
            <ProgressBar current={health.score} target={100} color={health.score < 50 ? 'red' : 'green'} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Plain-Text Score Formula</strong>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: 12 }}>
              Score = Savings Rate (0–40 pts, full 40 at ≥20% saved) + Budget Adherence (0–30 pts, % of this month&apos;s budgets within limit) + Bills On Time (0–30 pts, % of bills not overdue).
            </p>
            <span className="neutral-badge">
              Live breakdown: {health.savingsPts}/40 savings + {health.budgetPts}/30 budgets + {health.billPts}/30 bills = {health.score}/100
            </span>
          </div>
        </div>
      </section>

      <section className="metrics-grid" style={{ marginTop: 16 }} aria-label="Monthly insights">
        <Metric
          icon={Flame}
          label="Top spending category"
          value={topCategory ? topCategory.name : 'None yet'}
          small={topCategory ? `${money(topCategory.amount)} (${topCategory.percent}% of month expenses)` : `No ${formatMonth(month)} expenses`}
        />
        <Metric
          icon={TrendingUp}
          label="Biggest single expense"
          value={biggestExpense ? money(biggestExpense.amount) : '¥0'}
          small={biggestExpense ? `${biggestExpense.note || biggestExpense.title} · ${formatDate(biggestExpense.transaction_date)}` : `No ${formatMonth(month)} expenses`}
        />
        <Metric
          icon={Percent}
          label="Monthly savings rate"
          value={summary.income > 0 ? `${savingsRatePct}%` : '0%'}
          small={summary.income > 0 ? `${money(summary.net)} saved ÷ ${money(summary.income)} income` : 'Record income to calculate'}
        />
      </section>

      <div className="two-col-chart">
        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>Income vs Expenses ({formatMonth(month)})</h2>
            <span className={summary.net >= 0 ? 'positive small' : 'negative small'} style={{ fontWeight: 700 }}>
              Net: {money(summary.net)}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span>Income</span>
                <strong className="positive">{money(summary.income)}</strong>
              </div>
              <ProgressBar current={summary.income} target={barScale} color="green" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span>Expenses</span>
                <strong className="negative">{money(summary.expense)}</strong>
              </div>
              <ProgressBar current={summary.expense} target={barScale} color="red" />
            </div>
          </div>
          <p className="support-note">
            Safe-to-Spend formula: ({money(summary.income)} month income − {money(safe.billsStillDue)} bills still due − {money(safe.goalSavingPlan)} goal saving plan) ÷ {safe.daysLeft} days left = <strong>{money(safe.dailySafe)}/day</strong>.
          </p>
        </section>

        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>Savings Goal Progress</h2>
            <button className="text-action" type="button" onClick={() => navigate('/goals')}>View Goals</button>
          </div>
          {goals.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No savings goals yet"
              description="Set a JPY target to track progress here."
              action={<button className="btn secondary compact" type="button" onClick={() => navigate('/goals')}>Add Goal</button>}
            />
          ) : (
            goals.slice(0, 4).map((goal) => (
              <div key={goal.id} className="mini-goal">
                <div>
                  <strong>{goal.title}</strong>
                  <span>{money(goal.saved_amount)} / {money(goal.target_amount)} ({goalPercent(goal)}%)</span>
                </div>
                <ProgressBar current={goal.saved_amount} target={goal.target_amount} color="green" />
              </div>
            ))
          )}
        </section>
      </div>

      <div className="two-col-chart">
        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>5 Most Recent Transactions</h2>
            <button className="text-action" type="button" onClick={() => navigate('/transactions')}>See All</button>
          </div>
          {recentTx.length === 0 ? (
            <EmptyState
              icon="💳"
              title="No transactions yet"
              description="Recorded income and expenses appear here."
              action={<button className="btn primary compact" type="button" onClick={() => navigate('/transactions')}>Add Transaction</button>}
            />
          ) : (
            <div className="recent-list">
              {recentTx.map((tx) => (
                <div key={tx.id} className="recent-row">
                  <div className={`transaction-dot ${tx.kind}`}>
                    {tx.kind === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div>
                    <strong>{tx.note || tx.title}</strong>
                    <small>{tx.category_name || 'Category'} · {formatDate(tx.transaction_date)}</small>
                  </div>
                  <div className="recent-amount">
                    <Amount amount={tx.amount} type={tx.kind} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>Upcoming Bills (Next 7 Days)</h2>
            <button className="text-action" type="button" onClick={() => navigate('/bills')}>Manage Bills</button>
          </div>
          {overdueBillsCount > 0 && (
            <p className="negative small" style={{ marginTop: 0, fontWeight: 700 }}>
              ⚠️ You also have {overdueBillsCount} overdue {overdueBillsCount === 1 ? 'bill' : 'bills'}.
            </p>
          )}
          {upcoming7dBills.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="No bills due in the next 7 days"
              description="Schedule recurring bills to see upcoming due alerts."
              action={<button className="btn secondary compact" type="button" onClick={() => navigate('/bills')}>Go to Bills</button>}
            />
          ) : (
            <div>
              {upcoming7dBills.map((bill) => {
                const diff = daysBetweenISO(today, bill.due_date);
                return (
                  <div key={bill.id} className="bill-row">
                    <div className="bill-icon"><ReceiptText size={17} /></div>
                    <div>
                      <strong>{bill.name}</strong>
                      <p className="muted">{bill.category} · Due {formatDate(bill.due_date)}</p>
                    </div>
                    <div className="bill-due">
                      <strong>{money(bill.amount)}</strong>
                      <span>{diff === 0 ? 'Due today' : `In ${diff}d`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
