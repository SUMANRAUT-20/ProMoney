import { useEffect, useRef } from 'react';
import AuthView from '../auth/AuthView';
import './landingLogin.css';

export default function LandingLogin({ onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      className="landing-login-dialog"
      ref={dialogRef}
      aria-labelledby="pm-auth-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <AuthView onClose={() => dialogRef.current.close()} />
    </dialog>
  );
}
