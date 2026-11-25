import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthField, AuthNotice, SocialSignIn } from './AuthControls';
import { authFailure, readAuthForm } from './authValidation';

function serverField(error, signup) {
  if (signup && (error.status === 409 || error.message.startsWith('email must'))) return 'email';
  if (signup && error.message.startsWith('display_name must')) return 'last_name';
  if (error.message.startsWith('password must') || (!signup && error.status === 401)) return 'password';
  return null;
}

export default function AuthForm({ signup }) {
  const { login, register, loginDemo, isCheckingSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errors, setErrors] = useState({});
  const [issue, setIssue] = useState(null);
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState('');
  const [destination, setDestination] = useState('');
  const busy = isCheckingSession || Boolean(action);

  useEffect(() => {
    if (!destination) return;
    const timer = setTimeout(() => navigate(destination, { replace: true }), 640);
    return () => clearTimeout(timer);
  }, [destination, navigate]);

  function onInput(event) {
    if (Object.keys(errors).length) {
      const next = readAuthForm(event.currentTarget, signup).errors;
      setErrors(Object.fromEntries(Object.keys(errors).filter((name) => next[name]).map((name) => [name, next[name]])));
    }
    const name = event.target.name;
    if (issue && (name === issue.field || (issue.field === 'password' && !signup && name === 'email'))) setIssue(null);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setNotice('');
    setIssue(null);
    const { errors: next, credentials, display_name } = readAuthForm(event.currentTarget, signup);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      event.currentTarget.elements[first].focus();
      return;
    }

    setAction('submit');
    try {
      if (signup) await register({ ...credentials, display_name });
      else await login(credentials);
      setDestination(signup ? '/home' : location.state?.from || '/home');
    } catch (error) {
      const field = serverField(error, signup);
      if (field) setIssue({ field, message: error.message });
      else setNotice(authFailure(error));
      setAction('');
    }
  }

  async function demo() {
    if (busy) return;
    setNotice('');
    setIssue(null);
    setAction('demo');
    try {
      await loginDemo();
      setDestination('/home');
    } catch (error) {
      setNotice(authFailure(error));
      setAction('');
    }
  }

  const fieldError = (name) => errors[name] || (issue?.field === name ? issue.message : undefined);
  const submitDone = action === 'submit' && destination;
  const demoDone = action === 'demo' && destination;
  const passwordMode = signup ? 'new-password' : 'current-password';
  const submitLabels = signup
    ? { idle: 'Create account', pending: 'Creating account…', done: '✓ Account created' }
    : { idle: 'Log in', pending: 'Signing in…', done: '✓ Signed in' };
  const submitLabel = submitDone ? submitLabels.done : action === 'submit' ? submitLabels.pending : submitLabels.idle;

  return (
    <>
      <form noValidate className="form" onSubmit={submit} onInput={onInput} aria-busy={(busy && !destination) || undefined}>
        {signup && (
          <div className="form-row">
            <AuthField name="first_name" label="First name" autoComplete="given-name" placeholder="First name" error={fieldError('first_name')} />
            <AuthField name="last_name" label="Last name" autoComplete="family-name" placeholder="Last name" error={fieldError('last_name')} />
          </div>
        )}
        <AuthField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={fieldError('email')} />
        <AuthField
          name="password"
          label="Password"
          type="password"
          autoComplete={passwordMode}
          placeholder={signup ? 'At least 10 characters (letter + number)' : 'Enter your password'}
          error={fieldError('password')}
        />
        {signup ? (
          <AuthField name="confirm_password" label="Confirm password" type="password" autoComplete={passwordMode} placeholder="Re-enter your password" error={fieldError('confirm_password')} />
        ) : (
          <div className="pm-auth-help">
            <button type="button" className="pm-auth-text-button" onClick={() => setNotice('Password reset is not available yet. No reset email has been sent.')}>
              Forgot password?
            </button>
          </div>
        )}
        <AuthNotice>{notice}</AuthNotice>
        <div className="pm-auth-actions">
          <button className="btn primary pm-auth-submit" type="submit" disabled={busy} data-confirmed={submitDone ? true : undefined}>
            <span aria-live="polite">{submitLabel}</span>
          </button>
          <button className="btn secondary pm-auth-submit" type="button" disabled={busy} onClick={demo} data-confirmed={demoDone ? true : undefined}>
            <span aria-live="polite">{demoDone ? '✓ Demo ready' : action === 'demo' ? 'Opening demo…' : 'Try Demo Account (Sample data)'}</span>
          </button>
        </div>
      </form>
      <SocialSignIn />
    </>
  );
}
