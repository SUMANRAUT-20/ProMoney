import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute — Phase 1 (Arpan Khatiwada)
 *
 * Wraps the authenticated workspace. While a stored token is still
 * being verified against GET /api/auth/me, it shows a simple loading
 * state instead of flashing the login page or the workspace.
 * Unauthenticated visitors are sent to /login and the page they
 * wanted is kept in location state, so login can return them there.
 */
export default function ProtectedRoute({ children }) {
  const { user, isCheckingSession } = useAuth();
  const location = useLocation();

  if (isCheckingSession) {
    return (
      <main className="content" aria-live="polite">
        <p className="muted">Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
