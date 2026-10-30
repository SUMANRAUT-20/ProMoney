import { useId, useState } from 'react';
import { Eye, EyeOff, Github, Apple, Info } from 'lucide-react';

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
  const providers = [
    ['Google', <svg key="google" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3 6 6 0 1 1 1.3-9.5l3-3A10 10 0 1 0 12 22c5.8 0 9.6-4.1 9.6-9.8Z" /></svg>],
    ['Apple', <Apple key="apple" size={18} aria-hidden="true" />],
    ['Microsoft', <svg key="ms" width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M1 1h8v8H1zm10 0h8v8h-8zM1 11h8v8H1zm10 0h8v8h-8z" /></svg>],
    ['GitHub', <Github key="github" size={18} aria-hidden="true" />]
  ];
  return <section aria-label="Social sign-in options">
    <div className="pm-auth-divider"><span>or continue with</span></div>
    <div className="pm-auth-social">{providers.map(([name, icon]) => <button key={name} type="button" className="btn secondary" onClick={() => setProvider(name)} aria-describedby="pm-social-note">{icon}{name}</button>)}</div>
    <p className="pm-auth-hint" id="pm-social-note">Social sign-in is not connected yet.</p>
    <AuthNotice>{provider && `${provider} sign-in is not available yet. No account has been connected.`}</AuthNotice>
  </section>;
}
