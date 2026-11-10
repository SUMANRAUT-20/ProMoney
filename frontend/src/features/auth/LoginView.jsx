import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AuthNotice, PasswordField, SocialSignIn } from './AuthControls';
import WelcomeView from './WelcomeView';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';

export default function LoginView() {
  const [params] = useSearchParams();
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { t } = useFinance();
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
          : t('auth.serverUnreachable')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')} footer={<span>{t('auth.newTo')} <Link to="/register">{t('auth.createAccount')}</Link></span>}>
    <form className="form" onSubmit={handleSubmit}>
      <label>{t('auth.email')}<input name="email" type="email" required maxLength={255} placeholder="you@example.com" autoComplete="email" /></label>
      <PasswordField placeholder={t('auth.passwordPlaceholder')} />
      <div className="pm-auth-help"><button type="button" className="pm-auth-text-button" onClick={() => setNotice(t('auth.forgotNotice'))}>{t('auth.forgot')}</button></div>
      <AuthNotice>{notice}</AuthNotice>
      <button type="submit" className="btn primary pm-auth-submit" disabled={isSubmitting}>{isSubmitting ? t('auth.signingIn') : t('auth.login')}</button>
    </form>
    <SocialSignIn />
  </AuthLayout>;
}
