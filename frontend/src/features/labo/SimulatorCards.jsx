import { useState } from 'react';
import { money } from '../../utils/formatters';

export function PurchaseCard({ plan }) {
  return (
    <section aria-label="Purchase simulation">
      <strong>Simulation · {plan.verdict}</strong>
      <ul>
        <li>Item price {money(plan.amount)}</li>
        <li>Safe-to-spend per day {money(plan.before)} → {money(plan.after)}</li>
        <li>Safe-to-spend left this month {money(plan.remaining)}</li>
        <li>This month’s bills ({money(plan.bills)}) and minimum buffer ({money(plan.buffer)}) are {plan.covered ? 'covered' : 'short of funding'}.</li>
        <li>{plan.goal ? `${plan.goal}: ${plan.goalDelayDays === null ? 'no forecast yet' : `${plan.goalDelayDays} days of delay`}` : 'Add a target on Savings Goals to estimate a delay.'}</li>
      </ul>
      {plan.goal && <small>Goal delay assumes any cut into the plan comes out of savings once.</small>}
    </section>
  );
}

function proposalLabel(proposal) {
  const amount = money(proposal.amount);
  return proposal.kind === 'goal'
    ? `Contribute ${amount} to ${proposal.name}`
    : `Record a ${amount} payment from ${proposal.sourceName} to ${proposal.name}`;
}

export function AllocationCard({ plan, closed, busy, onConfirm }) {
  const [selected, setSelected] = useState(null);
  return (
    <section aria-label="Surplus allocation simulation">
      <strong>Simulation · Surplus allocation</strong>
      <ul>
        <li>Surplus {money(plan.surplus)} after unpaid bills ({money(plan.upcomingBills)}) and buffer ({money(plan.buffer)})</li>
        {plan.proposals.map((proposal) => (
          <li key={proposal.kind}>
            {proposalLabel(proposal)}{' '}
            {!closed && !selected && (
              <button type="button" className="btn secondary compact" disabled={busy} onClick={() => setSelected(proposal)}>Review</button>
            )}
          </li>
        ))}
        <li>{money(plan.unallocated)} spendable surplus remains unassigned after these suggestions.</li>
      </ul>
      {!plan.proposals.length && <p>Add a target on Savings Goals or check available funds on My Accounts.</p>}
      {closed && <small>Ask for a fresh allocation to review another action.</small>}
      {!!selected && !closed && (
        <div className="card section-card" aria-label="Confirm allocation">
          <p>{proposalLabel(selected)}?</p>
          <div className="inline-editor">
            <button type="button" className="btn secondary compact" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
            <button type="button" className="btn primary compact" disabled={busy} onClick={() => onConfirm(selected)}>Confirm &amp; Save</button>
          </div>
        </div>
      )}
    </section>
  );
}
