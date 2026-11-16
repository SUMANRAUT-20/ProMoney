import { useNavigate } from 'react-router-dom';
import { Calculator, Landmark } from 'lucide-react';
import { EmptyState, PageHeading } from '../../components/ui';

/**
 * Loans Placeholder View — Phase 5 (Constitution P5 & Feature Spec F12)
 * Full debt breakdown and Avalanche vs. Snowball payoff planner arrive
 * in Phase 6 (`feat/labo-simulators`).
 */
export default function LoansView() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeading
        title="Loans"
        subtitle="Per-debt breakdown, debt-free timeline, and Avalanche vs. Snowball payoff planner."
      />

      <section className="section-card card">
        <EmptyState
          icon="🏦"
          title="Coming in the simulator phase (Phase 6)"
          description="Track borrowed amounts, remaining balances, interest paid, and compare Avalanche vs. Snowball payoff strategies with the interactive extra-payment simulator."
          action={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn secondary compact" type="button" onClick={() => navigate('/my-accounts')}>
                <Landmark size={15} /> View My Accounts
              </button>
              <button className="btn primary compact" type="button" onClick={() => navigate('/labo')}>
                <Calculator size={15} /> Open ProMoney LA-BO
              </button>
            </div>
          }
        />
      </section>
    </>
  );
}
