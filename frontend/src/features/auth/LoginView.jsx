import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AuthNotice, PasswordField, SocialSignIn } from './AuthControls';
import WelcomeView from './WelcomeView';
import { apiClient, saveSession } from '../../services/api';

export default function LoginView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  if (params.get('view') === 'welcome') return <WelcomeView />;
  async function handleSubmit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setNotice('');
    try {
      const { token, user } = await apiClient.login({
        email: String(values.get('email') || '').trim(),
        password: String(values.get('password') || '')
      });
      saveSession(token, user);
      navigate('/dashboard');
    } catch (err) {
      setNotice(err.status === 401 ? 'Invalid email or password.' : (err.message || 'Login failed. Is the backend running?'));
    } finally {
      setBusy(false);
    }
  }
  return <AuthLayout title="Sign in to ProMoney" subtitle="Access your personal finance workspace (JPY)." footer={<span>New to ProMoney? <Link to="/register">Create an account</Link></span>}>
    <form className="form" onSubmit={handleSubmit}>
      <label>Email address<input name="email" type="email" required maxLength={255} placeholder="you@example.com" autoComplete="email" /></label>
      <PasswordField placeholder="Enter your password" />
      <div className="pm-auth-help"><button type="button" className="pm-auth-text-button" onClick={() => setNotice('Password reset is not available yet. No reset email has been sent.')}>Forgot password?</button></div>
      <AuthNotice>{notice}</AuthNotice>
      <button type="submit" className="btn primary pm-auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
    </form>
    <SocialSignIn />
  </AuthLayout>;
}
