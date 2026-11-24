import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { money } from '../../utils/formatters';
import { actionEntities, actionFields } from './chatActionFields';
import { chatActionLabel } from './chatActionProposal';

function ActionField({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{field.optional ? 'Unassigned' : `Choose ${field.label.toLowerCase()}`}</option>
        {field.options.map(({ value, label }, index) => <option key={`${value}-${index}`} value={value}>{label}</option>)}
      </select>
    );
  }
  return (
    <input type={field.type === 'yen' ? 'number' : field.type} value={value ?? ''}
      min={field.zero ? 0 : 1} step={field.type === 'yen' ? 1 : undefined} maxLength={field.limit}
      onChange={(event) => onChange(event.target.value)} />
  );
}

function fieldValue(field, value) {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'yen') return money(value);
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

export default function ChatActionCard({ proposal, busy, onConfirm, onCancel }) {
  const finance = useFinance();
  const [draft, setDraft] = useState(proposal.draft);
  const [editing, setEditing] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState('');
  const deleting = proposal.operation === 'delete';
  const title = `${{ create: 'Create', edit: 'Update', delete: 'Delete' }[proposal.operation]} ${actionEntities[proposal.entity].label}`;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    try {
      const result = await onConfirm(draft, deleteArmed ? 'delete-confirmed' : 'confirmed');
      if (result.needsDeleteConfirmation) setDeleteArmed(true);
      if (result.question) setError(result.question);
    } catch (err) {
      setError(err.message || 'Could not save the change. Try again.');
    }
  }

  return (
    <section className="card labo-statement-review" style={{ flexShrink: 0 }} aria-label="Proposed chat action">
      <h3>{title}</h3>
      {proposal.operation === 'edit' && <p className="muted small">Editing “{chatActionLabel(proposal, proposal.record)}”</p>}
      <form className="form" onSubmit={submit} noValidate>
        {deleteArmed && <p className="negative">Delete “{chatActionLabel(proposal)}”? Confirm again to remove it.</p>}
        {actionFields(proposal.entity, draft, finance).map((field) => {
          const fixedBudget = proposal.entity === 'budget' && proposal.record && field.key !== 'amount_limit';
          return editing && !fixedBudget ? (
            <label key={field.key}>
              {field.label}
              <ActionField field={field} value={draft[field.key]}
                onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} />
            </label>
          ) : (
            <div key={field.key} className="small"><strong>{field.label}</strong> · {fieldValue(field, draft[field.key])}</div>
          );
        })}
        {error && <p className="negative" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn secondary compact" disabled={busy} onClick={onCancel}>Cancel</button>
          {!deleting && !editing && (
            <button type="button" className="btn secondary compact" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
          )}
          <button type="submit" className="btn primary compact" disabled={busy}>{deleteArmed ? 'Delete' : 'Confirm'}</button>
        </div>
      </form>
    </section>
  );
}
