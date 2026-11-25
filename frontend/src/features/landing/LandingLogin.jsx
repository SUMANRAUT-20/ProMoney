import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { LoginForm } from '../auth/LoginView';
import './landingLogin.css';

export default function LandingLogin({ open, onClose, sessionAvailable }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const form = <LoginForm />;

  return (
    <dialog
      className="landing-login-dialog"
      ref={dialogRef}
      aria-labelledby="landing-login-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {open && (
        <div className="landing-login-surface">
          <button className="landing-login-close" type="button" aria-label="Close login" onClick={() => dialogRef.current.close()}>
            <span aria-hidden="true">×</span>
          </button>
          <h2 id="landing-login-title">Sign in to ProMoney</h2>
          <p>Access your personal finance workspace.</p>
          {sessionAvailable ? form : <AuthProvider>{form}</AuthProvider>}
          <p>New to ProMoney? <Link to="/register">Create an account</Link></p>
        </div>
      )}
    </dialog>
  );
}
