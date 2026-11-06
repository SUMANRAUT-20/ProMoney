import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AuthNotice, PasswordField, SocialSignIn } from './AuthControls';
import { useAuth } from '../../context/AuthContext';

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
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const firstName = String(values.get('first_name') || '').trim();
    const lastName = String(values.get('last_name') || '').trim();
    if (!firstName || !lastName) {
      setNotice('Please enter your first and last name.');
      return;
    }
    if (values.get('password') !== values.get('confirm_password')) {
      form.elements.confirm_password.setCustomValidity('Your passwords do not match.');
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
          : 'Could not reach the ProMoney server. Check that the backend is running, then try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthLayout title="Create your ProMoney account" subtitle="Start managing your money with clarity and confidence." footer={<span>Already have an account? <Link to="/login">Log in</Link></span>}>
    <form className="form" onSubmit={handleSubmit} onInput={event => { const confirm = event.currentTarget.elements.confirm_password; if (confirm) confirm.setCustomValidity(''); }}>
      <div className="form-row">
        <label>First name<input name="first_name" required maxLength={100} autoComplete="given-name" placeholder="First name" /></label>
        <label>Last name<input name="last_name" required maxLength={100} autoComplete="family-name" placeholder="Last name" /></label>
      </div>
      <label>Email address<input name="email" type="email" required maxLength={255} autoComplete="email" placeholder="you@example.com" /></label>
      <PasswordField minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
      <PasswordField name="confirm_password" label="Confirm password" minLength={8} autoComplete="new-password" placeholder="Re-enter your password" />
      <AuthNotice>{notice}</AuthNotice>
      <button className="btn primary pm-auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button>
    </form>
    <SocialSignIn />
  </AuthLayout>;
}
