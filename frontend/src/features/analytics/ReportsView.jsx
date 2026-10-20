import { Info } from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

/**
 * Reports & Analytics View Foundation
 * Joint Owners: Arpan Khatiwada & Suman Raut (Members 4 & 5)
 *
 * Clean starter foundation without fabricated category spending charts or totals.
 */
export default function ReportsView() {
  return (
    <>
      <PageHeading
        title="Reports & Analytics"
        subtitle="Review verified monthly income, expenses, category breakdowns, and CSV exports in JPY."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Reports Foundation (Phase 4 — Arpan &amp; Suman)</strong>
          <span>
            Feature not implemented yet. Financial reports will consume the shared backend calculation
            service (`GET /api/summary`) so Dashboard and Reports always match.
          </span>
        </div>
      </div>

      <section className="report-stats">
        <div className="card report-stat">
          <span>Monthly Income</span>
          <strong>—</strong>
        </div>
        <div className="card report-stat">
          <span>Monthly Expenses</span>
          <strong>—</strong>
        </div>
        <div className="card report-stat">
          <span>Monthly Net Cash Flow</span>
          <strong>—</strong>
        </div>
      </section>

      <section className="section-card card">
        <EmptyState
          icon="📈"
          title="Feature not implemented yet."
          description="Category spending charts and CSV report exports will appear here once connected to verified transaction data in Phase 4."
        />
      </section>
    </>
  );
}
