import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute — Phase 1 (Arpan Khatiwada)
 *
 * Wraps the authenticated workspace. While a stored token is still
 * being verified against GET /api/auth/me, it shows a simple loading
 * state instead of flashing the login page or the workspace.
 * Unauthenticated visits keep their requested page for login.
 * Ending a verified session sends the user to the landing.
 */
export default function ProtectedRoute({ children }) {
  const { user, isCheckingSession } = useAuth();
  const location = useLocation();
  const hadSession = useRef(false);

  useEffect(() => {
    if (!isCheckingSession && user) hadSession.current = true;
  }, [isCheckingSession, user]);

  if (isCheckingSession) {
    return (
      <main className="content" aria-live="polite">
        <p className="muted">Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return hadSession.current
      ? <Navigate to="/" replace />
      : <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
