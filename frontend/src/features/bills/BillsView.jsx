import { Info } from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

/**
 * Bills & Subscriptions View Foundation
 * Owner: Roshan Khanal (Member 3)
 *
 * Clean starter foundation without fabricated recurring bills.
 * Rule: Scheduled bills must never be counted twice as recorded expenses.
 */
export default function BillsView() {
  return (
    <>
      <PageHeading
        title="Bills & Subscriptions"
        subtitle="Track upcoming bills, recurring subscriptions, and scheduled payment dates in JPY."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Bills &amp; Subscriptions Foundation (Phase 3 — Roshan Khanal)</strong>
          <span>
            Feature not implemented yet. Upcoming bill tracking and subscription management will be
            implemented after coordinating the `bills` table migration with the backend team.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <EmptyState
          icon="🧾"
          title="Feature not implemented yet."
          description="No scheduled bills or subscriptions recorded. Reminder lists and recurring payment tracking will be implemented in Phase 3."
        />
      </section>
    </>
  );
}
