import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Note: the notice markup mirrors AuthNotice in AuthControls.jsx.
// It is duplicated on purpose so this file does not import
// AuthControls (which imports this file for SocialSignIn).

/**
 * Google Sign-In button — Google Identity Services (ID-token flow)
 *
 * Loads Google's official GSI script, which renders Google's own
 * button and returns an ID token credential. The credential is sent
 * to POST /api/auth/google; the backend verifies it and returns a
 * ProMoney JWT. No client secret is used (or needed) in the browser.
 *
 * Requires VITE_GOOGLE_CLIENT_ID in frontend/.env (the OAuth Web
 * Client ID from Google Cloud Console, with this app's origin —
 * e.g. http://localhost:5173 — in its Authorized JavaScript origins).
 * If the client ID is missing, the button explains that Google
 * sign-in is not configured instead of pretending to work.
 */

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let gsiScriptPromise = null;

function loadGsiScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google sign-in script failed to load'));
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

export default function GoogleSignInButton() {
  const containerRef = useRef(null);
  const [notice, setNotice] = useState('');
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            setNotice('');
            try {
              await loginWithGoogle(response.credential);
              navigate(location.state?.from || '/dashboard', { replace: true });
            } catch (err) {
              setNotice(
                err.status
                  ? err.message
                  : 'Could not reach the ProMoney server. Check that the backend is running, then try again.'
              );
            }
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 240,
        });
      })
      .catch(() => {
        if (!cancelled) setNotice('Google sign-in could not be loaded. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
    // location.state is only read inside the callback; init once per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, loginWithGoogle, navigate]);

  if (!clientId) {
    return <p className="pm-auth-hint">Google sign-in is not configured yet (VITE_GOOGLE_CLIENT_ID is missing).</p>;
  }

  return (
    <div className="pm-auth-google">
      <div ref={containerRef} aria-label="Continue with Google" />
      {notice ? (
        <div className="status-banner pm-auth-notice" role="status">
          <Info size={17} aria-hidden="true" />
          <div>{notice}</div>
        </div>
      ) : null}
    </div>
  );
}
