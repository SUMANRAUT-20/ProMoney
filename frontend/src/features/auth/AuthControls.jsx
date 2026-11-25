import { useId, useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton';

export function AuthField({ label, type, error, ...inputProps }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="pm-auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={isPassword ? 'pm-auth-password' : undefined}>
        <input
          id={id}
          type={visible ? 'text' : type}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + '-error' : undefined}
          {...inputProps}
        />
        {isPassword && (
          <button type="button" aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      <span id={id + '-error'} className="pm-auth-field-error" aria-live="polite">{error}</span>
    </div>
  );
}

export function AuthNotice({ children }) {
  return children ? <div className="status-banner pm-auth-notice" role="status"><Info size={17} aria-hidden="true" /><div>{children}</div></div> : null;
}

export function SocialSignIn() {
  return (
    <section aria-label="Social sign-in options">
      <div className="pm-auth-divider"><span>or continue with</span></div>
      <GoogleSignInButton />
    </section>
  );
}
