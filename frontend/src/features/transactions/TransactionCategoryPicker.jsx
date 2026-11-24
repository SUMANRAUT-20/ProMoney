import { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';

const NEW_CATEGORY = 'new-category';

export default function TransactionCategoryPicker({ kind, value, onChange, allowUncategorized }) {
  const { categories, saveCategory } = useFinance();
  const [previousValue, setPreviousValue] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (saving || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const category = await saveCategory({ name, kind });
      onChange(String(category.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form">
      <label>
        Category
        <select value={value} onChange={(event) => {
          if (event.target.value === NEW_CATEGORY) {
            setPreviousValue(value);
            setName('');
            setError('');
          }
          onChange(event.target.value);
        }} disabled={saving}>
          <option value="" disabled={!allowUncategorized}>{allowUncategorized ? 'Uncategorized' : 'Select a category'}</option>
          {categories.filter((category) => category.kind === kind).map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
          <option value={NEW_CATEGORY}>+ New category</option>
        </select>
      </label>
      {value === NEW_CATEGORY && (
        <>
          <label>
            New category name
            <input type="text" value={name} maxLength={60} autoFocus disabled={saving}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  create();
                }
              }}
            />
          </label>
          {error && <p className="negative" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn secondary compact" disabled={saving} onClick={() => onChange(previousValue)}>Cancel</button>
            <button type="button" className="btn primary compact" disabled={saving || !name.trim()} onClick={create}>Create category</button>
          </div>
        </>
      )}
    </div>
  );
}
