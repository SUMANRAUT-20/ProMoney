import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../services/api';

/**
 * Auth State Provider — Phase 3 Security Hardening & Real Demo Account
 *
 * - Real session tokens (including for the Demo Account) live in the
 *   `pm_session` httpOnly cookie only; the frontend NEVER stores a JWT
 *   token in localStorage.
 * - Any legacy `pm_auth_token` or `pm_demo_mode` key in localStorage is
 *   purged on startup.
 * - `loginDemo()` performs a real `/api/auth/login` call with the demo
 *   credentials from the root `.env` (`DEMO_EMAIL` / `DEMO_PASSWORD`).
 */

const LEGACY_TOKEN_KEY = 'pm_auth_token';
const LEGACY_DEMO_MODE_KEY = 'pm_demo_mode';
const USER_KEY = 'pm_auth_user';

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_DEMO_MODE_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Purge legacy fake local demo user object (`id === 'demo'`)
    if (parsed?.id === 'demo') {
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const sessionCheckStarted = useRef(false);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_DEMO_MODE_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Storage may be unavailable; state is still cleared.
    }
    setUser(null);
  }, []);

  const saveSession = useCallback(({ user: nextUser }) => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_DEMO_MODE_KEY);
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } catch {
      // If storage fails the in-memory session still works for this tab.
    }
    setUser(nextUser);
  }, []);

  useEffect(() => {
    if (sessionCheckStarted.current) return;
    sessionCheckStarted.current = true;
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(LEGACY_DEMO_MODE_KEY);
    } catch {
      // Ignore storage errors
    }

    apiClient
      .getMe()
      .then((payload) => {
        setUser(payload.data.user);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(payload.data.user));
        } catch {
          // Ignore storage errors; verified user is in state.
        }
      })
      .catch(() => {
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

  const loginDemo = useCallback(async () => {
    const email = String(import.meta.env.DEMO_EMAIL || 'demo@promoney.local').trim();
    const password = String(import.meta.env.DEMO_PASSWORD || '');
    const payload = await apiClient.login({ email, password });
    saveSession(payload.data);
    return payload.data.user;
  }, [saveSession]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // Clear local user state even if server is unreachable.
    }
    clearSession();
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await apiClient.logoutAll();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isCheckingSession,
      login,
      register,
      loginWithGoogle,
      loginDemo,
      logout,
      logoutAll,
      updateUser,
    }),
    [user, isCheckingSession, login, register, loginWithGoogle, loginDemo, logout, logoutAll, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
