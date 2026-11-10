import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AuthNotice, PasswordField, SocialSignIn } from './AuthControls';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';

/**
 * Register — wired to POST /api/auth/register (Phase 1, Arpan Khatiwada)
 *
 * Contract decision (docs/INTEGRATION_CONTRACT.md section 3.2):
 * the API accepts ONLY display_name, email, and password, and the
 * users table has no username / date_of_birth columns. So:
 * - first_name + last_name are combined into display_name (they are
 *   used, never discarded)
 * - the old UI-only username and date_of_birth inputs were REMOVED
 *   rather than collecting personal data the backend cannot store.
 * Bringing them back requires a contract amendment + a schema
 * migration approved by Arpan + Suman — not a silent frontend change.
 */
export default function RegisterView() {
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const { t } = useFinance();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const firstName = String(values.get('first_name') || '').trim();
    const lastName = String(values.get('last_name') || '').trim();
    if (!firstName || !lastName) {
      setNotice(t('auth.nameRequired'));
      return;
    }
    if (values.get('password') !== values.get('confirm_password')) {
      form.elements.confirm_password.setCustomValidity(t('auth.pwMismatch'));
      form.elements.confirm_password.reportValidity();
      return;
    }
    setNotice('');
    setIsSubmitting(true);
    try {
      await register({
        display_name: `${firstName} ${lastName}`,
        email: String(values.get('email') || '').trim(),
        password: String(values.get('password') || ''),
      });
      // Registration returns a token (201) — the user is signed in.
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Surfaces backend errors, e.g. 409 duplicate email or 400 validation.
      setNotice(
        err.status
          ? err.message
          : t('auth.serverUnreachable')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthLayout title={t('auth.createTitle')} subtitle={t('auth.createSubtitle')} footer={<span>{t('auth.alreadyHave')} <Link to="/login">{t('auth.loginLink')}</Link></span>}>
    <form className="form" onSubmit={handleSubmit} onInput={event => { const confirm = event.currentTarget.elements.confirm_password; if (confirm) confirm.setCustomValidity(''); }}>
      <div className="form-row">
        <label>{t('auth.firstName')}<input name="first_name" required maxLength={100} autoComplete="given-name" placeholder={t('auth.firstName')} /></label>
        <label>{t('auth.lastName')}<input name="last_name" required maxLength={100} autoComplete="family-name" placeholder={t('auth.lastName')} /></label>
      </div>
      <label>{t('auth.email')}<input name="email" type="email" required maxLength={255} autoComplete="email" placeholder="you@example.com" /></label>
      <PasswordField minLength={8} autoComplete="new-password" placeholder={t('auth.atLeast8')} />
      <PasswordField name="confirm_password" label={t('auth.confirmPassword')} minLength={8} autoComplete="new-password" placeholder={t('auth.confirmPlaceholder')} />
      <AuthNotice>{notice}</AuthNotice>
      <button className="btn primary pm-auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? t('auth.creating') : t('auth.createBtn')}</button>
    </form>
    <SocialSignIn />
  </AuthLayout>;
}
