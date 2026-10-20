import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import AuthLayout from './AuthLayout';

/**
 * Registration Page Foundation
 * Owner: Renuka Karmacharya (Member 2)
 *
 * Clean UI foundation for user registration. Does not fabricate account creation.
 */
export default function RegisterView() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setNotice(
      'Feature not implemented yet. Account registration will be connected to POST /api/auth/register in Phase 1.'
    );
  }

  return (
    <AuthLayout
      title="Create your ProMoney Account"
      subtitle="Start managing your JPY income, expenses, budgets, and savings goals."
      footer={
        <span>
          Already have an account? <Link to="/login">Sign in</Link>
        </span>
      }
    >
      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Foundation Placeholder</strong>
          <span>Feature not implemented yet. Backend registration is scheduled for Phase 1.</span>
        </div>
      </div>

      {notice && (
        <div className="status-banner" role="alert">
          <Info size={16} />
          <div>{notice}</div>
        </div>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <label>
          Display Name
          <input
            type="text"
            required
            maxLength={100}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Renuka Karmacharya"
            autoComplete="name"
          />
        </label>

        <label>
          Email Address
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </label>

        <button type="submit" className="btn primary" style={{ width: '100%', marginTop: 4 }}>
          Create Account
        </button>
      </form>
    </AuthLayout>
  );
}
