import { Info } from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

/**
 * Accounts View Foundation
 * Owner: Rajesh Mishra (Member 1)
 *
 * Clean starter foundation without fabricated bank or cash wallet balances.
 */
export default function AccountsView() {
  return (
    <>
      <PageHeading
        title="Accounts"
        subtitle="Manage your cash wallets, bank accounts, and credit card records in JPY."
      />

      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Accounts Foundation (Phase 2 — Rajesh Mishra)</strong>
          <span>
            Feature not implemented yet. Account creation, manual balance tracking (`manual_balance`),
            and `/api/accounts` integration will be implemented in this module.
          </span>
        </div>
      </div>

      <section className="section-card card">
        <EmptyState
          icon="🏦"
          title="Feature not implemented yet."
          description="No financial accounts connected. Account cards and manual JPY balance management will be implemented in Phase 2."
        />
      </section>
    </>
  );
}
