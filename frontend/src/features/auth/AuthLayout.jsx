import { Link } from 'react-router-dom';

/**
 * Shared Authentication Layout
 * Owner: Renuka Karmacharya (Member 2)
 *
 * Used by both LoginView and RegisterView to ensure a consistent
 * Template 21 Ultra-Clean Finance authentication experience.
 */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <section className="auth-card card">
        <div className="auth-header">
          <Link to="/dashboard" className="brand" aria-label="ProMoney home">
            <div className="brand-logo">¥</div>
            <span>ProMoney</span>
          </Link>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        {children}

        <div className="auth-footer">
          {footer}
          <div>
            <Link to="/dashboard">← Return to Workspace Foundation</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
