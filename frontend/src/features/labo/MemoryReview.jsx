import { useState } from 'react';
import { apiClient } from '../../services/api';

export default function MemoryReview({ proposal, onDecision }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function remember() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.saveNidhiMemory(proposal.patch);
      onDecision(true);
    } catch (err) {
      setError(err.message || 'Could not remember these details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card labo-statement-review" aria-label="Review what Nidhi remembers">
      <h3>Remember these details?</h3>
      <dl>
        {proposal.entries.map(({ section, key, label, value }) => (
          <div key={`${section}:${key}`}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {error && <p className="negative" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn secondary compact" disabled={saving} onClick={() => onDecision(false)}>Dismiss</button>
        <button type="button" className="btn primary compact" disabled={saving} onClick={remember}>Remember</button>
      </div>
    </section>
  );
}
