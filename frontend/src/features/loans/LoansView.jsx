import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../../components/ui';
import { apiClient } from '../../services/api';
import { money } from '../../utils/formatters';

function PayoffResult({ label, result }) {
  return (
    <section className="section-card card">
      <h3>{label}</h3>
      <p>Payment priority: {result.priority.join(' → ')}</p>
      {result.months === null ? <p>The plan does not pay off all debts within the projection.</p> : (
        <dl>
          <dt>Months to debt-free</dt><dd>{result.months}</dd>
          <dt>Total interest</dt><dd>{money(result.totalInterest)}</dd>
          <dt>Payoff order</dt><dd>{result.payoffOrder.join(' → ')}</dd>
        </dl>
      )}
    </section>
  );
}

function DebtFields({ debt, busy }) {
  return (
    <fieldset className="form-row">
      <legend>{debt.name} · {money(debt.balance)} owed</legend>
      <label>Annual interest rate (APR %)
        <input name={`apr-${debt.id}`} type="number" min="0" max="1000" step="any"
          defaultValue={debt.apr ?? ''} placeholder="Unknown" required disabled={busy} />
      </label>
      <label>Required monthly payment (JPY)
        <input name={`payment-${debt.id}`} type="number" min="0" step="1"
          defaultValue={debt.monthlyPayment ?? ''} placeholder="Unknown" required disabled={busy} />
      </label>
    </fieldset>
  );
}

export default function LoansView() {
  const [debts, setDebts] = useState(null);
  const [payoff, setPayoff] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient.getLoans().then(({ data }) => {
      if (active) setDebts(data.debts);
    }).catch((err) => {
      if (active) setError(err.message);
    });
    return () => { active = false; };
  }, []);

  const activeDebts = (debts ?? []).filter(({ balance }) => balance > 0);
  async function calculate(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const terms = Object.fromEntries(activeDebts.map(({ id }) => [
      id, { apr: fields.get(`apr-${id}`), monthlyPayment: fields.get(`payment-${id}`) },
    ]));
    setBusy(true);
    setError('');
    setPayoff(null);
    try {
      const { data } = await apiClient.calculateLoanPayoff({ monthlyBudget: fields.get('monthlyBudget'), terms });
      setDebts(data.debts);
      setPayoff(data.payoff);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="Loans" subtitle="Review credit card and loan balances and compare payoff strategies." />
      {error && <p role="alert">{error}</p>}
      {!debts && !error && <p role="status">Loading loans…</p>}
      {debts?.length === 0 && <p>Add a liability account on <Link to="/my-accounts">My Accounts</Link> to see it here.</p>}
      {debts?.length > 0 && (
        <section className="section-card card">
          <h2>Liability accounts</h2>
          <ul>
            {debts.map((debt) => <li key={debt.id}>{debt.name} · {money(debt.balance)} owed ·
              {' '}{debt.apr === null ? 'APR unknown' : `${debt.apr}% APR`} ·
              {' '}{debt.monthlyPayment === null ? 'Monthly payment unknown' : `${money(debt.monthlyPayment)} per month`}</li>)}
          </ul>
        </section>
      )}
      {activeDebts.length > 0 && (
        <section className="section-card card">
          <h2>Payoff planner</h2>
          <p className="muted">Simulation. Enter your terms and total monthly payoff budget. The projection assumes fixed rates, monthly interest, and no new charges or fees.</p>
          <form className="form" onSubmit={calculate} onChange={() => setPayoff(null)}>
            {activeDebts.map((debt) => <DebtFields key={debt.id} debt={debt} busy={busy} />)}
            <label>Total monthly payoff amount (JPY)
              <input name="monthlyBudget" type="number" min="1" step="1" required disabled={busy} />
            </label>
            <div><button type="submit" className="btn primary compact" disabled={busy}>{busy ? 'Calculating…' : 'Compare payoff plans'}</button></div>
          </form>
        </section>
      )}
      {payoff && <div className="form-row">
        <PayoffResult label="Avalanche · highest rate first" result={payoff.avalanche} />
        <PayoffResult label="Snowball · smallest balance first" result={payoff.snowball} />
      </div>}
    </>
  );
}
