import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, Goal, Info, Wallet } from 'lucide-react';
import { EmptyState, Metric, PageHeading } from '../../components/ui';

/**
 * Dashboard View Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut (Members 4 & 5)
 *
 * Clean starter foundation with zero fabricated figures or hardcoded chart data.
 */
export default function DashboardView() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeading
        title="Financial Overview"
        subtitle="Monitor your verified monthly cash flow, budget limits, and savings progress in JPY."
        action={
          <button className="btn secondary" type="button" onClick={() => navigate('/transactions')}>
            Go to Transactions
          </button>
        }
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Dashboard Foundation (Phase 4 — Arpan &amp; Suman)</strong>
          <span>
            Feature not implemented yet. Live monthly summaries and cash-flow charts will be populated
            from verified backend calculations (`GET /api/summary`).
          </span>
        </div>
      </div>

      <section className="dashboard-metrics" aria-label="Monthly key figures placeholder">
        <Metric icon={ArrowDownLeft} label="Income this month" value="—" small="Awaiting verified transactions" />
        <Metric icon={ArrowUpRight} label="Expenses this month" value="—" small="Awaiting verified transactions" />
        <Metric icon={Wallet} label="Net Cash Flow" value="—" small="Income minus expenses" />
        <Metric icon={Goal} label="Total Saved Toward Goals" value="—" small="Awaiting active savings goals" />
      </section>

      <section className="section-card card" style={{ marginTop: 16 }}>
        <EmptyState
          icon="📊"
          title="Feature not implemented yet."
          description="Dashboard charts, active savings goal summaries, and recent transaction activity will appear here once connected to the Express API and MySQL database."
        />
      </section>
    </>
  );
}
