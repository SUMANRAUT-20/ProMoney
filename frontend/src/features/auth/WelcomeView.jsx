import { Link } from 'react-router-dom';
import { ArrowUpRight, Wallet, Target, Sparkles } from 'lucide-react';
import AuthLayout from './AuthLayout';

export default function WelcomeView() {
  return <AuthLayout welcome>
    <section className="card pm-auth-hero">
      <div className="pm-auth-eyebrow">Your money. A clearer picture.</div>
      <h1>Master every yen with <em>clarity, confidence,</em> and explainable AI.</h1>
      <p>ProMoney is designed for life in Japan. Bring daily income, expenses, monthly budgets, recurring bills, and savings goals together in one clear workspace.</p>
      <div className="pm-auth-actions"><Link className="btn primary" to="/register">Create free account <ArrowUpRight size={17} /></Link><Link className="btn secondary" to="/login">Log in to your account</Link></div>
      <p className="pm-auth-hint">Create an account or log in to open your workspace.</p>
    </section>
    <div className="pm-auth-features">
      <section className="card"><Wallet size={22} /><h2>Know where your yen goes.</h2><p>Income, expenses, cash, and bank accounts in one overview.</p></section>
      <section className="card"><Target size={22} /><h2>Make room for what matters.</h2><p>Plan category budgets, recurring bills, and savings goals.</p></section>
      <section className="card"><Sparkles size={22} /><h2>Understand the insight.</h2><p>ProMoney Lab is planned to provide explainable insights based on verified records.</p></section>
    </div>
  </AuthLayout>;
}
