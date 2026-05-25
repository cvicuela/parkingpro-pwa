import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authAPI } from '../services/api';
import { isTokenExpired } from '../services/supabaseClient';

const AuthContext = createContext(null);

function isProfileComplete(user) {
  if (!user) return true; // no user = not relevant
  return !!(user.first_name && user.last_name);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      // Ignore a cached user if the token is gone/expired (otherwise the UI looks
      // logged-in while every RPC fails with "No autorizado").
      if (isTokenExpired()) return null;
      return JSON.parse(localStorage.getItem('pp_user'));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const profileComplete = useMemo(() => isProfileComplete(user), [user]);

  useEffect(() => {
    const token = localStorage.getItem('pp_token');
    if (token && isTokenExpired(token)) {
      // Stale/expired token from a previous visit — drop it so the user is sent to login.
      localStorage.removeItem('pp_token');
      localStorage.removeItem('pp_user');
      setUser(null);
      setLoading(false);
      return;
    }
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

  const updateUser = useCallback((updatedFields) => {
    setUser(prev => {
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('pp_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    authAPI.logout().catch(() => {});
    localStorage.removeItem('pp_token');
    localStorage.removeItem('pp_user');
    localStorage.removeItem('pp_terminal');
    localStorage.removeItem('pp_settings');
    setUser(null);
  }, []);

  const isProfileIncomplete = useCallback((u) => {
    const target = u || user;
    if (!target) return false;
    return !target.first_name || !target.last_name;
  }, [user]);

  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser, isProfileIncomplete, profileComplete }), [user, loading, login, register, logout, updateUser, isProfileIncomplete, profileComplete]);

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
