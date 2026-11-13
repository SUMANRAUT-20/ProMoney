import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../services/api';

/**
 * Auth State Provider — Phase 1 & Phase 2 Demo Account Honesty (O1/O2)
 *
 * - Real accounts verify their JWT against GET /api/auth/me and read/write
 *   exclusively through the TiDB backend API.
 * - The Demo Account (`loginDemo`) is explicitly flagged `is_demo: true`
 *   so every screen displays the "Sample data" banner (Constitution O1)
 *   and demo data stays completely isolated from real user data (O2).
 */

const TOKEN_KEY = 'pm_auth_token';
const USER_KEY = 'pm_auth_user';
const DEMO_TOKEN = 'demo-session';

export const DEMO_USER = {
  id: 'demo',
  display_name: 'Sample Demo Account',
  email: 'demo@promoney.local',
  is_demo: true,
};

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
  const [isCheckingSession, setIsCheckingSession] = useState(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    return Boolean(token && token !== DEMO_TOKEN);
  });
  const sessionCheckStarted = useRef(false);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // Storage may be unavailable; state is still cleared.
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

  useEffect(() => {
    if (sessionCheckStarted.current) return;
    sessionCheckStarted.current = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsCheckingSession(false);
      return;
    }
    if (token === DEMO_TOKEN) {
      setUser(DEMO_USER);
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
    saveSession({ token: DEMO_TOKEN, user: DEMO_USER });
    return DEMO_USER;
  }, [saveSession]);

  const logout = useCallback(() => {
    clearSession();
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
      updateUser,
    }),
    [user, isCheckingSession, login, register, loginWithGoogle, loginDemo, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
