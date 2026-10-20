import { useEffect } from 'react';
import { X } from 'lucide-react';
import { money } from '../../utils/formatters';

export function PageHeading({ title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}

export function Metric({ icon: Icon, label, value, small }) {
  return (
    <div className="metric card">
      <span className="metric-icon">
        <Icon size={21} />
      </span>
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-number">{value}</div>
        {small && <div className="muted small">{small}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({ current, target, color = 'green' }) {
  const percent = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
  return (
    <div
      className={`progress-track ${color}`}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const keyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function EmptyState({ icon = '✨', title, description }) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}

export function Amount({ amount, type }) {
  return (
    <span className={type === 'income' ? 'positive' : 'negative'}>
      {type === 'income' ? '+' : '−'}
      {money(amount)}
    </span>
  );
}
