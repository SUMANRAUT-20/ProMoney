import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import AuthLayout from './AuthLayout';

/**
 * Login Page Foundation
 * Owner: Renuka Karmacharya (Member 2)
 *
 * Clean UI foundation for user sign-in. Does not fabricate login success.
 */
export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setNotice(
      'Feature not implemented yet. Authentication login will be connected to POST /api/auth/login in Phase 1.'
    );
  }

  return (
    <AuthLayout
      title="Sign in to ProMoney"
      subtitle="Access your personal finance workspace (JPY)."
      footer={
        <span>
          Don&apos;t have an account yet? <Link to="/register">Create an account</Link>
        </span>
      }
    >
      <div className="status-banner" role="status">
        <Info size={16} />
        <div>
          <strong>Foundation Placeholder</strong>
          <span>Feature not implemented yet. Backend authentication is scheduled for Phase 1.</span>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </label>

        <button type="submit" className="btn primary" style={{ width: '100%', marginTop: 4 }}>
          Sign In
        </button>
      </form>
    </AuthLayout>
  );
}
