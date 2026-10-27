import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AuthNotice, PasswordField, SocialSignIn } from './AuthControls';
import WelcomeView from './WelcomeView';

export default function LoginView() {
  const [params] = useSearchParams();
  const [notice, setNotice] = useState('');
  if (params.get('view') === 'welcome') return <WelcomeView />;
  function handleSubmit(event) {
    event.preventDefault();
    // The supplied backend returns HTTP 501. Do not fabricate a session.
    setNotice('Login is not connected yet. Your details have not been sent or saved.');
  }
  return <AuthLayout title="Sign in to ProMoney" subtitle="Access your personal finance workspace (JPY)." footer={<span>New to ProMoney? <Link to="/register">Create an account</Link></span>}>
    <form className="form" onSubmit={handleSubmit}>
      <label>Email address<input name="email" type="email" required maxLength={255} placeholder="you@example.com" autoComplete="email" /></label>
      <PasswordField placeholder="Enter your password" />
      <div className="pm-auth-help"><button type="button" className="pm-auth-text-button" onClick={() => setNotice('Password reset is not available yet. No reset email has been sent.')}>Forgot password?</button></div>
      <AuthNotice>{notice}</AuthNotice>
      <button type="submit" className="btn primary pm-auth-submit">Log in</button>
    </form>
    <SocialSignIn />
    <p className="pm-auth-hint">Authentication is under development. This form does not create a session.</p>
  </AuthLayout>;
}
