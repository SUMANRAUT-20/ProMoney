import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { AuthNotice, PasswordField, SocialSignIn } from './AuthControls';
import { apiClient, saveSession } from '../../services/api';

export default function RegisterView() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    if (!values.get('first_name').trim() || !values.get('last_name').trim()) {
      setNotice('Please enter your first and last name.');
      return;
    }
    if (values.get('password') !== values.get('confirm_password')) {
      form.elements.confirm_password.setCustomValidity('Your passwords do not match.');
      form.elements.confirm_password.reportValidity();
      return;
    }
    // The API contract (docs/INTEGRATION_CONTRACT.md) takes display_name,
    // email and password. Username and birth date are part of the form
    // design but are not sent until the contract is extended.
    setBusy(true);
    setNotice('');
    try {
      const { token, user } = await apiClient.register({
        display_name: `${values.get('first_name').trim()} ${values.get('last_name').trim()}`,
        email: String(values.get('email') || '').trim(),
        password: String(values.get('password') || '')
      });
      saveSession(token, user);
      navigate('/dashboard');
    } catch (err) {
      setNotice(err.message || 'Registration failed. Is the backend running?');
    } finally {
      setBusy(false);
    }
  }
  return <AuthLayout title="Create your ProMoney account" subtitle="Start managing your money with clarity and confidence." footer={<span>Already have an account? <Link to="/login">Log in</Link></span>}>
    <form className="form" onSubmit={handleSubmit} onInput={event => { const confirm = event.currentTarget.elements.confirm_password; if (confirm) confirm.setCustomValidity(''); setNotice(''); }}>
      <label>Username<input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" title="Use 3–24 letters, numbers or underscores" autoComplete="username" placeholder="e.g. arpan_k" aria-describedby="pm-username-help" /></label>
      <p id="pm-username-help" className="pm-auth-hint pm-auth-field-hint">3–24 letters, numbers or underscores.</p>
      <div className="form-row">
        <label>First name<input name="first_name" required maxLength={100} autoComplete="given-name" placeholder="First name" /></label>
        <label>Last name<input name="last_name" required maxLength={100} autoComplete="family-name" placeholder="Last name" /></label>
      </div>
      <label>Date of birth<input name="date_of_birth" type="date" required max={today} autoComplete="bday" /></label>
      <label>Email address<input name="email" type="email" required maxLength={255} autoComplete="email" placeholder="you@example.com" /></label>
      <PasswordField minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
      <PasswordField name="confirm_password" label="Confirm password" minLength={8} autoComplete="new-password" placeholder="Re-enter your password" />
      <AuthNotice>{notice}</AuthNotice>
      <button className="btn primary pm-auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
    </form>
    <SocialSignIn />
    <p className="pm-auth-hint">Your password is stored only as a secure hash on the server — never as plain text.</p>
  </AuthLayout>;
}
