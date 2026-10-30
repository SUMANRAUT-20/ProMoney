import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AuthNotice, PasswordField, SocialSignIn } from './AuthControls';
import WelcomeView from './WelcomeView';
import { useAuth } from '../../context/AuthContext';

export default function LoginView() {
  const [params] = useSearchParams();
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (params.get('view') === 'welcome') return <WelcomeView />;

  async function handleSubmit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setNotice('');
    setIsSubmitting(true);
    try {
      await login({
        email: String(values.get('email') || '').trim(),
        password: String(values.get('password') || ''),
      });
      // Return to the page ProtectedRoute sent us from, else dashboard.
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      // apiClient surfaces the backend's error message (e.g. the
      // generic 401 "Invalid email or password" from /api/auth/login).
      // A network failure has no backend message, so explain that.
      setNotice(
        err.status
          ? err.message
          : 'Could not reach the ProMoney server. Check that the backend is running, then try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthLayout title="Sign in to ProMoney" subtitle="Access your personal finance workspace (JPY)." footer={<span>New to ProMoney? <Link to="/register">Create an account</Link></span>}>
    <form className="form" onSubmit={handleSubmit}>
      <label>Email address<input name="email" type="email" required maxLength={255} placeholder="you@example.com" autoComplete="email" /></label>
      <PasswordField placeholder="Enter your password" />
      <div className="pm-auth-help"><button type="button" className="pm-auth-text-button" onClick={() => setNotice('Password reset is not available yet. No reset email has been sent.')}>Forgot password?</button></div>
      <AuthNotice>{notice}</AuthNotice>
      <button type="submit" className="btn primary pm-auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Log in'}</button>
    </form>
    <SocialSignIn />
  </AuthLayout>;
}
