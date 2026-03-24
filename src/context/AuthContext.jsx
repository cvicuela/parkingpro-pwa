import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pp_user'));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pp_token');
    if (token && !user) {
      authAPI.me()
        .then(({ data }) => {
          setUser(data.data || data.user || data);
          localStorage.setItem('pp_user', JSON.stringify(data.data || data.user || data));
        })
        .catch(() => {
          localStorage.removeItem('pp_token');
          localStorage.removeItem('pp_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    const userData = data.data?.user || data.user;
    const token = data.data?.token || data.token;
    localStorage.setItem('pp_token', token);
    localStorage.setItem('pp_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (formData) => {
    const { data } = await authAPI.register(formData);
    const userData = data.data?.user || data.user;
    const token = data.data?.token || data.token;
    if (token) {
      localStorage.setItem('pp_token', token);
      localStorage.setItem('pp_user', JSON.stringify(userData));
      setUser(userData);
    }
    return userData;
  }, []);

  const logout = useCallback(() => {
    authAPI.logout().catch(() => {});
    localStorage.removeItem('pp_token');
    localStorage.removeItem('pp_user');
    localStorage.removeItem('pp_terminal');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
