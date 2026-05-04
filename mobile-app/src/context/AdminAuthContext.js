import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api, { clearAuthToken, setAuthToken } from '../api/axios';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState('');

  const login = useCallback(async (name, password) => {
    const res = await api.post('/auth/login', { username: name, password });
    setToken(res.data.token);
    setUsername(res.data.username || name);
    setAuthToken('admin', res.data.token);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUsername('');
    clearAuthToken('admin');
  }, []);

  const value = useMemo(
    () => ({
      token,
      username,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, username, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
