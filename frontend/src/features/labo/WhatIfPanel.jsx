import { useState } from 'react';
import { apiClient } from '../../services/api';
import { money } from '../../utils/formatters';

export function WhatIfPanel({ categories }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setResult(null);
    setError('');
    setBusy(true);
    try {
      const response = await apiClient.laboWhatIf({
        moreIncome: fields.get('moreIncome') || '0',
        lessSpending: fields.get('lessSpending') || '0',
        categoryId: fields.get('categoryId'),
      });
      setResult(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="section-card card">
      <summary><strong>What-if simulator</strong></summary>
      <p className="muted">Simulation. The projection applies the same change each month to your recent recorded cash flow.</p>
      <form className="form" onSubmit={run} onChange={() => setResult(null)}>
        <div className="form-row">
          <label>Earn more per month (JPY)<input name="moreIncome" type="number" min="0" step="1" placeholder="0" disabled={busy} /></label>
          <label>Spend less per month (JPY)<input name="lessSpending" type="number" min="0" step="1" placeholder="0" disabled={busy} /></label>
        </div>
        <label>Expense category
          <select name="categoryId" disabled={busy}>
            <option value="">Choose a category for a spending reduction</option>
            {categories.filter((category) => category.kind === 'expense').map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <div><button type="submit" className="btn primary compact" disabled={busy}>{busy ? 'Projecting…' : 'Compare projections'}</button></div>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && <Projection result={result} />}
    </details>
  );
}

function Projection({ result }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="What-if projection">
      <table className="finance-table">
        <caption>Projected net worth and goal date</caption>
        <thead><tr><th scope="col">Measure</th><th scope="col">Current projection</th><th scope="col">What if</th></tr></thead>
        <tbody>
          <tr>
            <th scope="row">{result.goal || 'Top savings goal'}</th>
            <td>{result.currentDate || 'No date yet'}</td>
            <td>{result.scenarioDate || 'No date yet'}</td>
          </tr>
          {result.currentTrend.map(({ month, balance }, index) => (
            <tr key={month}><th scope="row">{month}</th><td>{money(balance)}</td><td>{money(result.scenarioTrend[index].balance)}</td></tr>
          ))}
        </tbody>
      </table>
      {!result.goal && <p className="muted">Add an unfinished target on Savings Goals to project its reach date.</p>}
      {!result.hasHistory && <p className="muted">Add past income or expenses on Transactions for a cash-flow baseline. The current projection uses zero monthly change.</p>}
    </div>
  );
}
