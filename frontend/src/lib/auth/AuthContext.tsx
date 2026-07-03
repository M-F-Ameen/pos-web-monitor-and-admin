'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_URL || 'http://localhost:4000/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, isAdmin?: boolean) => Promise<void>;
  loginTenant: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwt(token: string) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function isTokenExpired(token: string): boolean {
  const decoded = parseJwt(token);
  return decoded?.exp ? decoded.exp * 1000 < Date.now() : false;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const STORAGE_KEY = 'pos_monitor_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    // Try localStorage first
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.user && !isTokenExpired(parsed.token)) {
          setState({ user: parsed.user, token: parsed.token, loading: false });
          return;
        }
      }
    } catch { /* ignore */ }

    // Fallback to cookie
    const cookieToken = getCookie('pos_token') || getCookie('pos_admin_token');
    if (cookieToken && !isTokenExpired(cookieToken)) {
      const decoded = parseJwt(cookieToken);
      if (decoded) {
        const user = {
          id: decoded.sub || '',
          email: decoded.email || '',
          name: decoded.name || decoded.email || '',
          role: decoded.role || 'user',
          tenantId: decoded.tenantId || decoded.tenant_id,
        };
        if (user.id) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: cookieToken, user }));
          setState({ user, token: cookieToken, loading: false });
          return;
        }
      }
    }

    setState({ user: null, token: null, loading: false });
  }, []);

  useEffect(() => {
    apiClient.setAuthHeaderProvider((): Record<string, string> => {
      if (!state.token) return {};
      return { Authorization: `Bearer ${state.token}` };
    });
  }, [state.token]);

  const setCookie = (name: string, value: string) => {
    document.cookie = `${name}=${value}; path=/; max-age=86400; SameSite=Lax`;
  };

  const removeCookie = (name: string) => {
    document.cookie = `${name}=; path=/; max-age=0`;
  };

  const persist = useCallback((token: string, user: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    setState({ user, token, loading: false });
    if (user.tenantId) {
      setCookie('pos_token', token);
      removeCookie('pos_admin_token');
    } else {
      setCookie('pos_admin_token', token);
      removeCookie('pos_token');
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || `خطأ في الخادم (${res.status})`);
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Login failed');
    persist(data.token, data.user);
  }, [persist]);

  const loginTenant = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || `خطأ في الخادم (${res.status})`);
    }
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Login failed');
    persist(data.token, data.user);
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    removeCookie('pos_token');
    removeCookie('pos_admin_token');
    setState({ user: null, token: null, loading: false });
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!state.token) return {};
    return { Authorization: `Bearer ${state.token}` };
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ ...state, login, loginTenant, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
