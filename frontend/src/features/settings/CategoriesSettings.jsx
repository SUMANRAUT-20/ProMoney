import { useState } from 'react';
import { Modal } from '../../components/ui';
import { useFinance } from '../../context/FinanceContext';

export default function CategoriesSettings() {
  const { budgets, categories, saveCategory, removeCategory } = useFinance();
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function openCategory(category = { name: '', kind: 'expense' }) {
    setError('');
    setDraft(category);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await saveCategory({ ...draft, name: draft.name.trim() }, draft.id);
      setDraft(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await removeCategory(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section-card card settings-card" aria-labelledby="categories-heading">
      <div className="section-title">
        <h2 id="categories-heading">Categories</h2>
        <button className="btn secondary" type="button" onClick={() => openCategory()}>Add category</button>
      </div>
      {[true, false].map((isDefault) => (
        <div key={String(isDefault)}>
          <h3>{isDefault ? 'Default categories' : 'My categories'}</h3>
          {categories.filter((category) => category.is_default === isDefault).map((category) => (
            <div className="setting-row" key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <div className="muted small">{category.kind === 'expense' ? 'Expense' : 'Income'}</div>
              </div>
              {!isDefault && (
                <div className="form-actions">
                  <button className="btn secondary compact" type="button" aria-label={`Rename ${category.name}`} onClick={() => openCategory(category)}>Rename</button>
                  <button className="btn secondary compact" type="button" aria-label={`Delete ${category.name}`} onClick={() => { setError(''); setDeleteTarget(category); }}>Delete</button>
                </div>
              )}
            </div>
          ))}
          {!isDefault && !categories.some((category) => !category.is_default) && <p className="muted">No custom categories yet.</p>}
        </div>
      ))}
      {draft && (
        <Modal title={draft.id ? 'Rename category' : 'Add category'} onClose={() => !busy && setDraft(null)}>
          <form className="form" onSubmit={submit}>
            <label>
              Name
              <input type="text" value={draft.name} maxLength={60} required autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            {!draft.id && (
              <label>
                Type
                <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
            )}
            {error && <p className="negative" role="alert">{error}</p>}
            <div className="form-actions">
              <button className="btn secondary" type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy || !draft.name.trim()}>Save category</button>
            </div>
          </form>
        </Modal>
      )}
      {deleteTarget && (
        <Modal title="Delete category" onClose={() => !busy && setDeleteTarget(null)}>
          <p>
            Delete <strong>{deleteTarget.name}</strong>? Its transactions will move to Uncategorized.
            {budgets.some((budget) => budget.category_id === deleteTarget.id) && ' Budgets using this category will also be deleted.'}
          </p>
          {error && <p className="negative" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="btn secondary" type="button" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn primary" type="button" disabled={busy} onClick={confirmDelete}>Delete category</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
