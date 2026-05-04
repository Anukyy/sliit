import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api, { clearAuthToken, setAuthToken } from '../api/axios';

const StaffAuthContext = createContext(null);

export function StaffAuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/staff-portal/login', { username, password });
    setToken(res.data.token);
    setProfile({
      name: res.data.name,
      username: res.data.username,
      roleName: res.data.roleName,
    });
    setAuthToken('staff', res.data.token);
    return res.data;
  }, []);

  const fetchMe = useCallback(async () => {
    if (!token) return null;
    const res = await api.get('/staff-portal/me');
    const next = {
      name: res.data?.name,
      username: res.data?.username,
      roleName: res.data?.role?.name || '',
    };
    setProfile(next);
    return next;
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setProfile(null);
    clearAuthToken('staff');
  }, []);

  const value = useMemo(
    () => ({
      token,
      profile,
      isAuthenticated: Boolean(token),
      login,
      fetchMe,
      logout,
    }),
    [token, profile, login, fetchMe, logout]
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth() {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return ctx;
}
