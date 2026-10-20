import { Info } from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

/**
 * Transactions View Foundation
 * Owner: Rajesh Mishra (Member 1)
 *
 * Clean starter foundation without demo transactions or local mock state.
 */
export default function TransactionsView() {
  return (
    <>
      <PageHeading
        title="Transactions"
        subtitle="Record, search, filter, and categorize your income and expenses in JPY."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Transactions Foundation (Phase 2 — Rajesh Mishra)</strong>
          <span>
            Feature not implemented yet. Transaction recording, category selection, filtering, and
            API integration (`GET / POST / DELETE /api/transactions`) will be built in this module.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <EmptyState
          icon="💳"
          title="Feature not implemented yet."
          description="No transactions recorded. Income and expense forms, category filters, and transaction tables will be implemented in Phase 2."
        />
      </section>
    </>
  );
}
