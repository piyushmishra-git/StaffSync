import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setAccessToken, refreshSession } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on first load (refresh cookie -> new in-memory access token).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await refreshSession();
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) setAccessToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onForcedLogout = () => {
      setAccessToken(null);
      setUser(null);
    };
    window.addEventListener('hr:logout', onForcedLogout);
    return () => window.removeEventListener('hr:logout', onForcedLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Session already invalid - clear local state regardless.
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homePathFor(user) {
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'manager') return '/team';
  return '/app';
}
