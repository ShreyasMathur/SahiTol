import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { can as canRole } from '@nawi/shared';
import { api, UNAUTHORIZED_EVENT } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // The session cookie is httpOnly, so ask the server who we are.
  useEffect(() => {
    Promise.all([api.auth.me().catch(() => null), api.auth.status().catch(() => ({ setupRequired: false }))])
      .then(([me, status]) => {
        setUser(me);
        setSetupRequired(status.setupRequired);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser((current) => {
        if (current) setSessionExpired(true);
        return null;
      });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  /** Called after any flow that opens a session (sign-in, first-run setup, activation link). */
  const signedIn = useCallback((u) => {
    setSessionExpired(false);
    setSetupRequired(false);
    setUser(u);
  }, []);

  const login = useCallback(async (username, password) => signedIn(await api.auth.login(username, password)), [signedIn]);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {});
    setSessionExpired(false);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setupRequired,
      sessionExpired,
      login,
      logout,
      signedIn,
      setUser,
      can: (permission) => canRole(user?.role, permission),
    }),
    [user, loading, setupRequired, sessionExpired, login, logout, signedIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
