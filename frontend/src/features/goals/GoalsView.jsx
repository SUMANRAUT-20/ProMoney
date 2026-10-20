import { Info } from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

/**
 * Savings Goals View Foundation
 * Owner: Roshan Khanal (Member 3)
 *
 * Clean starter foundation without sample savings goals or fake balances.
 */
export default function GoalsView() {
  return (
    <>
      <PageHeading
        title="Savings Goals"
        subtitle="Set JPY savings targets, record goal contributions, and monitor milestone progress."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Savings Goals Foundation (Phase 3 — Roshan Khanal)</strong>
          <span>
            Feature not implemented yet. Goal creation, contribution tracking, and progress calculation
            (`/api/goals`) will be implemented in this module.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <EmptyState
          icon="🎯"
          title="Feature not implemented yet."
          description="No savings goals created yet. Target creation and goal progress cards will be implemented in Phase 3."
        />
      </section>
    </>
  );
}
