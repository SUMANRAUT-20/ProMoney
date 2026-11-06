import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, PiggyBank, Plus, TrendingUp, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { EmptyState, Metric, PageHeading, ProgressBar } from '../../components/ui';
import { currentMonthISO, formatMonth, money, prevMonthISO } from '../../utils/formatters';
import { getCategoryBreakdown, getMonthlySavingsSeries, getMonthlySummary } from '../../utils/financeMath';

function SavingsGrowthSvg({ series }) {
  const values = series.map((item) => item.cumulative);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(1, ...values);
  const span = Math.max(1, maxVal - minVal);
  const left = 54;
  const right = 576;
  const top = 30;
  const bottom = 166;

  const toPoint = (item, index) => {
    const x = series.length === 1 ? (left + right) / 2 : left + (index / (series.length - 1)) * (right - left);
    const y = bottom - ((item.cumulative - minVal) / span) * (bottom - top);
    return { ...item, x: Math.round(x), y: Math.round(y) };
  };

  const points = series.map(toPoint);
  const zeroY = Math.round(bottom - ((0 - minVal) / span) * (bottom - top));
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 620 205" width="100%" role="img" aria-label="Cumulative savings growth across months">
      <line x1={left} y1={top} x2={right} y2={top} stroke="var(--border)" strokeDasharray="4 4" />
      <line x1={left} y1={zeroY} x2={right} y2={zeroY} stroke="var(--border)" />
      {points.length > 1 && (
        <polyline fill="none" stroke="var(--green)" strokeWidth="3" strokeLinejoin="round" points={polylinePoints} />
      )}
      {points.map((p) => (
        <g key={p.month}>
          <circle cx={p.x} cy={p.y} r="5" fill="var(--green)" />
          <text x={p.x} y={Math.max(16, p.y - 10)} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
            {money(p.cumulative)}
          </text>
          <text x={p.x} y="190" textAnchor="middle" fontSize="11" fill="var(--muted)">
            {formatMonth(p.month)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ReportsView() {
  const navigate = useNavigate();
  const { transactions, categories } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthISO);

  const prevMonth = prevMonthISO(selectedMonth, -1);
  const currentSummary = getMonthlySummary(transactions, selectedMonth);
  const lastSummary = getMonthlySummary(transactions, prevMonth);
  const breakdown = getCategoryBreakdown(transactions, selectedMonth, categories);
  const series = getMonthlySavingsSeries(transactions);

  const totalSaved = series.length > 0 ? series[series.length - 1].cumulative : 0;
  const growthDelta = currentSummary.net - lastSummary.net;
  const growthPct = lastSummary.net !== 0 ? Math.round((growthDelta / Math.abs(lastSummary.net)) * 100) : null;
  const growthLabel = `${growthDelta >= 0 ? '+' : ''}${money(growthDelta)}${
    growthPct !== null ? ` (${growthPct >= 0 ? '+' : ''}${growthPct}%)` : ''
  }`;

  return (
    <>
      <PageHeading
        title="Reports & Analytics"
        subtitle="Monthly category spending breakdown and cumulative JPY savings growth."
        action={
          <label className="inline-editor" style={{ marginTop: 0, alignItems: 'center' }}>
            <CalendarDays size={18} />
            <input
              type="month"
              value={selectedMonth}
              aria-label="Report month"
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
            />
          </label>
        }
      />

      <section className="dashboard-metrics" style={{ marginBottom: 16 }}>
        <Metric
          icon={PiggyBank}
          label="Total saved (all months)"
          value={money(totalSaved)}
          small={`Across ${series.length} recorded ${series.length === 1 ? 'month' : 'months'}`}
        />
        <Metric
          icon={TrendingUp}
          label="Growth vs last month"
          value={growthLabel}
          small={`${formatMonth(selectedMonth)} net ${money(currentSummary.net)} vs ${formatMonth(prevMonth)} ${money(lastSummary.net)}`}
        />
        <Metric
          icon={Wallet}
          label={`Income (${formatMonth(selectedMonth)})`}
          value={money(currentSummary.income)}
          small="Selected month inflows"
        />
        <Metric
          icon={ArrowUpRight}
          label={`Expenses (${formatMonth(selectedMonth)})`}
          value={money(currentSummary.expense)}
          small={`${breakdown.items.length} active categories`}
        />
      </section>

      <div className="two-col-chart" style={{ marginTop: 0, marginBottom: 16 }}>
        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>Savings Growth Across Months</h2>
            <span className="muted small">Cumulative net saved (income − expenses)</span>
          </div>
          {series.length === 0 ? (
            <EmptyState
              icon="📈"
              title="No monthly history yet"
              description="Record income and expenses to plot your cumulative JPY savings growth line."
              action={
                <button className="btn primary" type="button" onClick={() => navigate('/transactions')}>
                  <Plus size={15} /> Add Transactions
                </button>
              }
            />
          ) : (
            <>
              <SavingsGrowthSvg series={series} />
              <div className="table-scroll" style={{ marginTop: 10 }}>
                <table className="finance-table" style={{ minWidth: 440 }}>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="align-right">Income</th>
                      <th className="align-right">Expenses</th>
                      <th className="align-right">Monthly Saved</th>
                      <th className="align-right">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((row) => (
                      <tr key={row.month}>
                        <td className="table-strong">{formatMonth(row.month)}</td>
                        <td className="align-right positive">{money(row.income)}</td>
                        <td className="align-right negative">{money(row.expense)}</td>
                        <td className={`align-right ${row.net >= 0 ? 'positive' : 'negative'}`}>{money(row.net)}</td>
                        <td className="align-right table-strong">{money(row.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="section-card card" style={{ marginBottom: 0 }}>
          <div className="section-title">
            <h2>Category Breakdown ({formatMonth(selectedMonth)})</h2>
            <span className="muted small">Total: {money(breakdown.totalExpense)}</span>
          </div>
          {breakdown.items.length === 0 ? (
            <EmptyState
              icon="🥧"
              title={`No expenses in ${formatMonth(selectedMonth)}`}
              description="Add expenses in this month to see spending by category."
              action={
                <button className="btn primary" type="button" onClick={() => navigate('/transactions')}>
                  <Plus size={15} /> Record Expense
                </button>
              }
            />
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {breakdown.items.map((cat) => (
                <div key={cat.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <strong>{cat.name}</strong>
                    <span>
                      {money(cat.amount)} <span className="muted">({cat.percent}%)</span>
                    </span>
                  </div>
                  <ProgressBar current={cat.amount} target={breakdown.totalExpense} color="green" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
