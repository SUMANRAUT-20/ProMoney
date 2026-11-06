import { useId, useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton';

export function PasswordField({ label = 'Password', name = 'password', autoComplete = 'current-password', ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="pm-auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="pm-auth-password"><input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required {...props} />
      <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  </div>;
}
export function AuthNotice({ children }) {
  return children ? <div className="status-banner pm-auth-notice" role="status"><Info size={17} aria-hidden="true" /><div>{children}</div></div> : null;
}
export function SocialSignIn() {
  // Google is the only social sign-in offered (decision by Arpan,
  // 2026-10-30: Apple / Microsoft / GitHub buttons removed, not just
  // disabled — see GoogleSignInButton for the connected Google flow).
  return <section aria-label="Social sign-in options">
    <div className="pm-auth-divider"><span>or continue with</span></div>
    <GoogleSignInButton />
  </section>;
}
