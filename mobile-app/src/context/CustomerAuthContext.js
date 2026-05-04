import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import api, { clearAuthToken, setAuthToken } from '../api/axios';

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [customer, setCustomer] = useState(null);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/customer-auth/login', { email, password });
    setToken(res.data.token);
    setCustomer(res.data.customer || null);
    setAuthToken('customer', res.data.token);
    return res.data.customer;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/customer-auth/register', payload);
    setToken(res.data.token);
    setCustomer(res.data.customer || null);
    setAuthToken('customer', res.data.token);
    return res.data.customer;
  }, []);

  const fetchMe = useCallback(async () => {
    if (!token) return null;
    const res = await api.get('/customer-auth/me');
    setCustomer(res.data || null);
    return res.data;
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setCustomer(null);
    clearAuthToken('customer');
  }, []);

  const value = useMemo(
    () => ({
      token,
      customer,
      isAuthenticated: Boolean(token),
      login,
      register,
      fetchMe,
      logout,
    }),
    [token, customer, login, register, fetchMe, logout]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
