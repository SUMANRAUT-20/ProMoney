import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, CheckCircle2,
  Flame, Percent, Plus, ReceiptText, ShieldCheck, TrendingUp, Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Amount, EmptyState, Metric, PageHeading, ProgressBar } from '../../components/ui';
import { currentMonthISO, daysBetweenISO, formatDate, formatMonth, goalPercent, money, todayISO } from '../../utils/formatters';
import {
  getAccountTotals, getBalanceProjection, getBudgetStatus, getCategoryBreakdown,
  getHealthScore, getMonthlySummary, getSafeToSpend, txBaseAmount,
} from '../../utils/financeMath';

export default function DashboardView() {
  const navigate = useNavigate();
  const { accounts, transactions, budgets, bills, goals, categories, t } = useFinance();

  const today = todayISO();
  const month = currentMonthISO();
  const accountTotals = getAccountTotals(accounts, transactions);
  const summary = getMonthlySummary(transactions, month);

  const monthlyBudgets = budgets
    .filter((b) => String(b.budget_month || '').slice(0, 7) === month)
    .map((b) => getBudgetStatus(b, transactions));

  const health = getHealthScore({ monthIncome: summary.income, monthExpense: summary.expense, monthlyBudgets, bills, today });
  const safe = getSafeToSpend({ monthIncome: summary.income, bills, goals, today });
  const projection = getBalanceProjection({ netBalance: accountTotals.net, monthExpense: summary.expense, today });

  const breakdown = getCategoryBreakdown(transactions, month, categories);
  const topCategory = breakdown.items[0] || null;

  const monthExpensesList = transactions.filter(
    (t) => t.kind === 'expense' && String(t.transaction_date || '').slice(0, 7) === month,
  );
  const biggestExpense = monthExpensesList.reduce(
    (max, tx) => (!max || txBaseAmount(tx) > txBaseAmount(max) ? tx : max),
    null,
  );
  const savingsRatePct = summary.income > 0 ? Math.round((summary.net / summary.income) * 100) : 0;

  const upcoming7dBills = bills
    .filter((b) => !b.is_paid && daysBetweenISO(today, b.due_date) >= 0 && daysBetweenISO(today, b.due_date) <= 7)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const overdueBillsCount = bills.filter((b) => !b.is_paid && b.due_date < today).length;
  const recentTx = [...transactions]
    .sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)))
    .slice(0, 5);

  const barScale = Math.max(summary.income, summary.expense, 1);

  return (
    <>
      <PageHeading
        title={t('dash.title')}
        subtitle={t('dash.subtitle', { month: formatMonth(month) })}
        action={<button className="btn primary" type="button" onClick={() => navigate('/transactions')}><Plus size={16} /> {t('dash.record')}</button>}
      />

      <div className={`status-banner ${projection.goesNegative ? 'danger' : ''}`} role={projection.goesNegative ? 'alert' : 'status'}>
        {projection.goesNegative ? <AlertTriangle size={18} color="var(--red)" /> : <CheckCircle2 size={18} color="var(--green)" />}
        <div>
          <strong>
            {projection.goesNegative
              ? t('dash.bannerWarnTitle', { amount: money(projection.projectedEndBalance) })
              : t('dash.bannerOkTitle', { amount: money(projection.projectedEndBalance) })}
          </strong>
          <span>
            {projection.goesNegative
              ? t('dash.bannerWarnText', { pace: money(projection.dailyPace) })
              : t('dash.bannerOkText', { month: formatMonth(month), pace: money(projection.dailyPace) })}
          </span>
        </div>
      </div>

      <section className="dashboard-metrics" aria-label={t('dash.primaryMetrics')}>
        <Metric icon={Wallet} label={t('dash.totalBalance')} value={money(accountTotals.net)} small={t('dash.holdOwe', { held: money(accountTotals.held), owed: money(accountTotals.owed) })} />
        <Metric icon={ArrowDownLeft} label={t('dash.income', { month: formatMonth(month) })} value={money(summary.income)} small={t('dash.inflows')} />
        <Metric icon={ArrowUpRight} label={t('dash.expenses', { month: formatMonth(month) })} value={money(summary.expense)} small={t('dash.net', { amount: money(summary.net) })} />
        <Metric
          icon={CalendarClock}
          label={t('dash.safeToSpend')}
          value={`${money(safe.dailySafe)} / day`}
          small={t('dash.safeFormula', { income: money(summary.income), bills: money(safe.billsStillDue), goals: money(safe.goalSavingPlan), days: safe.daysLeft })}
        />
      </section>

      <section className="section-card card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180 }}>
            <span className="eyebrow">{t('dash.healthEyebrow')}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 8px' }}>
              <ShieldCheck size={24} color="var(--green)" />
              <strong style={{ fontSize: 30, letterSpacing: '-0.8px' }}>{health.score}</strong>
              <span className="muted">/ 100</span>
            </div>
            <ProgressBar current={health.score} target={100} color={health.score < 50 ? 'red' : 'green'} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>{t('dash.healthFormulaTitle')}</strong>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: 12 }}>
              {t('dash.healthFormula')}
            </p>
            <span className="neutral-badge">
              {t('dash.healthBreakdown', { s: health.savingsPts, b: health.budgetPts, bl: health.billPts, total: health.score })}
            </span>
          </div>
        </div>
      </section>

      <section className="metrics-grid" style={{ marginTop: 16 }} aria-label={t('dash.monthlyInsights')}>
        <Metric
          icon={Flame}
          label={t('dash.topCategory')}
          value={topCategory ? topCategory.name : t('dash.noneYet')}
          small={topCategory ? t('dash.topCategorySmall', { amount: money(topCategory.amount), percent: topCategory.percent }) : t('dash.noMonthExpenses', { month: formatMonth(month) })}
        />
        <Metric
          icon={TrendingUp}
          label={t('dash.biggestExpense')}
          value={biggestExpense ? money(txBaseAmount(biggestExpense)) : '¥0'}
          small={biggestExpense ? `${biggestExpense.note || biggestExpense.title} · ${formatDate(biggestExpense.transaction_date)}` : t('dash.noMonthExpenses', { month: formatMonth(month) })}
        />
        <Metric
          icon={Percent}
          label={t('dash.savingsRate')}
          value={summary.income > 0 ? `${savingsRatePct}%` : '0%'}
          small={summary.income > 0 ? t('dash.savedOf', { net: money(summary.net), income: money(summary.income) }) : t('dash.recordIncome')}
        />
      </section>

      <div className="two-col-chart">
        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>{t('dash.incomeVsExpenses', { month: formatMonth(month) })}</h2>
            <span className={summary.net >= 0 ? 'positive small' : 'negative small'} style={{ fontWeight: 700 }}>{t('dash.netLabel', { amount: money(summary.net) })}</span>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span>{t('dash.incomeLabel')}</span><strong className="positive">{money(summary.income)}</strong>
              </div>
              <ProgressBar current={summary.income} target={barScale} color="green" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <span>{t('dash.expensesLabel')}</span><strong className="negative">{money(summary.expense)}</strong>
              </div>
              <ProgressBar current={summary.expense} target={barScale} color="red" />
            </div>
          </div>
          <p className="support-note">
            {t('dash.safeNote', { income: money(summary.income), bills: money(safe.billsStillDue), goals: money(safe.goalSavingPlan), days: safe.daysLeft, daily: money(safe.dailySafe) })}
          </p>
        </section>

        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>{t('dash.goalProgress')}</h2>
            <button className="text-action" type="button" onClick={() => navigate('/goals')}>{t('dash.viewGoals')}</button>
          </div>
          {goals.length === 0 ? (
            <EmptyState icon="🎯" title={t('dash.noGoalsTitle')} description={t('dash.noGoalsDesc')} action={<button className="btn secondary compact" type="button" onClick={() => navigate('/goals')}>{t('dash.addGoal')}</button>} />
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
            <h2>{t('dash.recentTx')}</h2>
            <button className="text-action" type="button" onClick={() => navigate('/transactions')}>{t('dash.seeAll')}</button>
          </div>
          {recentTx.length === 0 ? (
            <EmptyState icon="💳" title={t('dash.noTxTitle')} description={t('dash.noTxDesc')} action={<button className="btn primary compact" type="button" onClick={() => navigate('/transactions')}>{t('dash.addTx')}</button>} />
          ) : (
            <div className="recent-list">
              {recentTx.map((tx) => (
                <div key={tx.id} className="recent-row">
                  <div className={`transaction-dot ${tx.kind}`}>{tx.kind === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div>
                  <div>
                    <strong>{tx.note || tx.title}</strong>
                    <small>{tx.category_name || t('dash.categoryFallback')} · {formatDate(tx.transaction_date)}</small>
                  </div>
                  <div className="recent-amount"><Amount amount={tx.amount} type={tx.kind} /></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>{t('dash.upcomingBills')}</h2>
            <button className="text-action" type="button" onClick={() => navigate('/bills')}>{t('dash.manageBills')}</button>
          </div>
          {overdueBillsCount > 0 && (
            <p className="negative small" style={{ marginTop: 0, fontWeight: 700 }}>
              {t(overdueBillsCount === 1 ? 'dash.overdueOne' : 'dash.overdueMany', { count: overdueBillsCount })}
            </p>
          )}
          {upcoming7dBills.length === 0 ? (
            <EmptyState icon="🧾" title={t('dash.noBillsTitle')} description={t('dash.noBillsDesc')} action={<button className="btn secondary compact" type="button" onClick={() => navigate('/bills')}>{t('dash.goToBills')}</button>} />
          ) : (
            <div>
              {upcoming7dBills.map((bill) => {
                const diff = daysBetweenISO(today, bill.due_date);
                return (
                  <div key={bill.id} className="bill-row">
                    <div className="bill-icon"><ReceiptText size={17} /></div>
                    <div>
                      <strong>{bill.name}</strong>
                      <p className="muted">{bill.category} · {t('dash.dueLabel', { date: formatDate(bill.due_date) })}</p>
                    </div>
                    <div className="bill-due">
                      <strong>{money(bill.amount)}</strong>
                      <span>{diff === 0 ? t('dash.dueToday') : t('dash.inDays', { days: diff })}</span>
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
