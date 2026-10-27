import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3 } from 'lucide-react';
import './auth.css';

// Auth-only layout. Uses the existing Template 21 theme variables.
export default function AuthLayout({ title, subtitle, children, footer, welcome = false }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="pm-auth">
      <header className="pm-auth-topbar">
        <Link to="/login?view=welcome" className="brand" aria-label="ProMoney welcome">
          <div className="brand-logo">¥</div>
          <span>ProMoney<small>Personal Finance · Japan (JPY)</small></span>
        </Link>
        <div className="pm-auth-header-tools">
          <nav aria-label="Authentication"><Link className="btn secondary" to="/login">Log in</Link><Link className="btn primary" to="/register">Sign up</Link></nav>
          <div className="pm-auth-clock"><Clock3 size={24} aria-hidden="true" /><div>
            <time dateTime={now.toISOString()}>{now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tokyo' })}</time>
            <small>{now.toLocaleDateString('en-GB', { timeZone: 'Asia/Tokyo', day: '2-digit', month: 'short', weekday: 'short' })} · JST</small>
          </div></div>
        </div>
      </header>
      <main className={welcome ? 'pm-auth-main pm-auth-welcome' : 'pm-auth-main'}>
        {welcome ? children : <section className="auth-card card pm-auth-card">
          <Link className="pm-auth-back" to="/login?view=welcome"><ArrowLeft size={15} /> Back to main screen</Link>
          <div className="auth-header"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
          {children}
          <div className="auth-footer">{footer}</div>
        </section>}
      </main>
      <footer className="pm-auth-bottom"><span>© {now.getFullYear()} ProMoney</span><span>Clarity for every yen. Confidence for every day.</span></footer>
    </div>
  );
}
