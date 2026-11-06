import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../services/api';

/**
 * Auth State Provider — Phase 1 (Arpan Khatiwada, Auth Frontend + Backend)
 *
 * Owns the login session for the whole app:
 * - token is stored in localStorage under `pm_auth_token`
 *   (the exact key frontend/src/services/api.js already sends as
 *   `Authorization: Bearer <token>` on every request)
 * - the public user object ({ id, display_name, email }) is stored
 *   under `pm_auth_user` so the UI can show who is signed in
 * - on first load, a stored token is verified against the backend
 *   (GET /api/auth/me). An invalid/expired token is cleared — the app
 *   never treats a stored string as proof of a session on its own.
 */

const TOKEN_KEY = 'pm_auth_token';
const USER_KEY = 'pm_auth_user';

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [isCheckingSession, setIsCheckingSession] = useState(
    () => Boolean(localStorage.getItem(TOKEN_KEY))
  );
  const sessionCheckStarted = useRef(false);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Storage may be unavailable (private mode); state is still cleared.
    }
    setUser(null);
  }, []);

  const saveSession = useCallback(({ token, user: nextUser }) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } catch {
      // If storage fails the in-memory session still works for this tab.
    }
    setUser(nextUser);
  }, []);

  // Verify a stored token once on load (StrictMode-safe).
  useEffect(() => {
    if (sessionCheckStarted.current) return;
    sessionCheckStarted.current = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsCheckingSession(false);
      return;
    }
    apiClient
      .getMe()
      .then((payload) => {
        setUser(payload.data.user);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(payload.data.user));
        } catch {
          // Ignore storage errors; the verified user is in state.
        }
      })
      .catch(() => {
        // Token rejected (401), expired, or backend unreachable:
        // do not keep a session we could not verify.
        clearSession();
      })
      .finally(() => setIsCheckingSession(false));
  }, [clearSession]);

  const login = useCallback(
    async ({ email, password }) => {
      const payload = await apiClient.login({ email, password });
      saveSession(payload.data);
      return payload.data.user;
    },
    [saveSession]
  );

  const register = useCallback(
    async ({ display_name, email, password }) => {
      const payload = await apiClient.register({ display_name, email, password });
      saveSession(payload.data);
      return payload.data.user;
    },
    [saveSession]
  );

  const loginWithGoogle = useCallback(
    async (idToken) => {
      const payload = await apiClient.googleAuth({ id_token: idToken });
      saveSession(payload.data);
      return payload.data.user;
    },
    [saveSession]
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, isCheckingSession, login, register, loginWithGoogle, logout }),
    [user, isCheckingSession, login, register, loginWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
