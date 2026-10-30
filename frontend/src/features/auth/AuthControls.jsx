import { useId, useState } from 'react';
import { Eye, EyeOff, Github, Apple, Info } from 'lucide-react';
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
  const [provider, setProvider] = useState('');
  // Google is connected (see GoogleSignInButton). The other providers
  // are not — their buttons keep saying so honestly.
  const providers = [
    ['Apple', <Apple key="apple" size={18} aria-hidden="true" />],
    ['Microsoft', <svg key="ms" width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M1 1h8v8H1zm10 0h8v8h-8zM1 11h8v8H1zm10 0h8v8h-8z" /></svg>],
    ['GitHub', <Github key="github" size={18} aria-hidden="true" />]
  ];
  return <section aria-label="Social sign-in options">
    <div className="pm-auth-divider"><span>or continue with</span></div>
    <GoogleSignInButton />
    <div className="pm-auth-social">{providers.map(([name, icon]) => <button key={name} type="button" className="btn secondary" onClick={() => setProvider(name)} aria-describedby="pm-social-note">{icon}{name}</button>)}</div>
    <p className="pm-auth-hint" id="pm-social-note">Apple, Microsoft, and GitHub sign-in are not connected yet.</p>
    <AuthNotice>{provider && `${provider} sign-in is not available yet. No account has been connected.`}</AuthNotice>
  </section>;
}
