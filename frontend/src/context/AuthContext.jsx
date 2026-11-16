import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../services/api';

/**
 * Auth State Provider — Phase 3 Security Hardening
 *
 * - Real session tokens live in the `pm_session` httpOnly cookie only;
 *   the frontend NEVER stores a JWT token in localStorage.
 * - Any legacy `pm_auth_token` key in localStorage is purged on startup.
 * - Demo mode uses a non-secret boolean flag (`pm_demo_mode`) to display
 *   the "Sample data" workspace (Constitution O1/O2).
 */

const LEGACY_TOKEN_KEY = 'pm_auth_token';
const USER_KEY = 'pm_auth_user';
const DEMO_MODE_KEY = 'pm_demo_mode';

export const DEMO_USER = {
  id: 'demo',
  display_name: 'Sample Demo Account',
  email: 'demo@promoney.local',
  is_demo: true,
};

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    if (localStorage.getItem(DEMO_MODE_KEY) === 'true') {
      return DEMO_USER;
    }
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [isCheckingSession, setIsCheckingSession] = useState(() => {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const sessionCheckStarted = useRef(false);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(DEMO_MODE_KEY);
    } catch {
      // Storage may be unavailable; state is still cleared.
    }
    setUser(null);
  }, []);

  const saveSession = useCallback(({ user: nextUser }) => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(DEMO_MODE_KEY);
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
      if (localStorage.getItem(DEMO_MODE_KEY) === 'true') {
        setUser(DEMO_USER);
        setIsCheckingSession(false);
        return;
      }
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

  const loginDemo = useCallback(() => {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.setItem(DEMO_MODE_KEY, 'true');
      localStorage.setItem(USER_KEY, JSON.stringify(DEMO_USER));
    } catch {
      // Ignore storage errors
    }
    setUser(DEMO_USER);
    return DEMO_USER;
  }, []);

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
