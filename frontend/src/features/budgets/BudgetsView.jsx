import { Info } from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

/**
 * Budgets View Foundation
 * Owner: Roshan Khanal (Member 3)
 *
 * Clean starter foundation without demo budget limits or sample spending.
 */
export default function BudgetsView() {
  return (
    <>
      <PageHeading
        title="Monthly Budgets"
        subtitle="Set monthly JPY spending limits by category and track budget usage."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Budgets Foundation (Phase 3 — Roshan Khanal)</strong>
          <span>
            Feature not implemented yet. Monthly budget creation, progress bars, and remaining budget
            calculations (`/api/budgets`) will be implemented in this module.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <EmptyState
          icon="📉"
          title="Feature not implemented yet."
          description="No monthly category budgets configured. Budget limit forms and category spending progress views will be implemented in Phase 3."
        />
      </section>
    </>
  );
}
