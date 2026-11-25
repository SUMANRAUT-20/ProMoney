import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthForm from './AuthForm';
import './auth.css';

export default function AuthView({ signup = false, onClose }) {
  const [modalSignup, setModalSignup] = useState(false);
  const location = useLocation();
  const creating = onClose ? modalSignup : signup;
  const Heading = onClose ? 'h2' : 'h1';
  const switchLabel = creating ? 'Log in' : 'Create an account';

  return (
    <div className="pm-auth">
      <aside className="pm-auth-brand">
        <Link to="/" className="pm-auth-mark" onClick={onClose} aria-label="ProMoney landing">
          <img src="/promoney-symbol.webp" width="48" height="48" alt="" />
          ProMoney
        </Link>
        <p>Clarity for every yen.</p>
      </aside>
      <section className="pm-auth-body">
        <header className="pm-auth-header">
          <div>
            {!onClose && <Link className="pm-auth-text-button pm-auth-back" to="/">← Back to landing</Link>}
            <Heading id="pm-auth-title">{creating ? 'Create your ProMoney account' : 'Sign in to ProMoney'}</Heading>
            <p>{creating ? 'Start managing your money with clarity and confidence.' : 'Access your personal finance workspace (JPY).'}</p>
          </div>
          {onClose && <button className="pm-auth-close" type="button" aria-label="Close login" onClick={onClose}>×</button>}
        </header>
        <AuthForm key={creating} signup={creating} />
        <p className="pm-auth-switch">
          {creating ? 'Already have an account? ' : 'New to ProMoney? '}
          {onClose ? (
            <button className="pm-auth-text-button" type="button" onClick={() => setModalSignup(!creating)}>{switchLabel}</button>
          ) : (
            <Link className="pm-auth-text-button" to={creating ? '/login' : '/register'} state={location.state}>{switchLabel}</Link>
          )}
        </p>
      </section>
    </div>
  );
}
