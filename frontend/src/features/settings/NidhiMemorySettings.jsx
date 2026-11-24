import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui';
import { apiClient } from '../../services/api';

export default function NidhiMemorySettings() {
  const [entries, setEntries] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient.getNidhiMemory().then(({ data }) => {
      if (active) setEntries(data.entries);
    }).catch((err) => {
      if (active) setError(err.message || 'Could not load remembered details.');
    });
    return () => { active = false; };
  }, []);

  function open(entry = null) {
    setError('');
    setPending({ entry });
  }

  async function forget() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await apiClient.forgetNidhiMemory(pending.entry);
      setEntries(data.entries);
      setPending(null);
    } catch (err) {
      setError(err.message || 'Could not remove remembered details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section-card card settings-card" aria-labelledby="nidhi-memory">
      <div className="section-title">
        <h2 id="nidhi-memory">What Nidhi remembers</h2>
        <button type="button" className="btn secondary" onClick={() => open()} disabled={!entries?.length}>Clear all</button>
      </div>
      {!entries && !error && <p className="muted" role="status">Loading…</p>}
      {entries?.length === 0 && <p className="muted">No remembered details yet.</p>}
      {entries?.map((entry) => (
        <div className="setting-row" key={`${entry.section}:${entry.key}`}>
          <div><strong>{entry.label}</strong><div>{entry.value}</div></div>
          <button type="button" className="btn secondary compact" onClick={() => open(entry)}
            aria-label={`Forget ${entry.label}`}>Forget</button>
        </div>
      ))}
      {error && !pending && <p role="alert" className="negative">{error}</p>}
      {pending && (
        <Modal title={pending.entry ? 'Forget this detail' : 'Clear Nidhi memory'} onClose={() => !busy && setPending(null)}>
          <p>{pending.entry ? `Remove “${pending.entry.label}” from memory?` : 'Remove all remembered details?'}</p>
          {error && <p role="alert" className="negative">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn secondary" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="btn primary" disabled={busy} onClick={forget}>{pending.entry ? 'Forget' : 'Clear all'}</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
