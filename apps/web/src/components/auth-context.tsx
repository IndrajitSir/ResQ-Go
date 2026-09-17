'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserView } from '@abs/contracts';
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
  getStoredUser,
  setAccessToken,
  setStoredUser,
} from '@/lib/api';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'PATIENT' | 'DRIVER';
}

interface AuthContextValue {
  user: UserView | null;
  token: string | null;
  /** False until the stored token (if any) has been validated against /users/me. */
  ready: boolean;
  login: (input: LoginInput) => Promise<UserView>;
  register: (input: RegisterInput) => Promise<UserView>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  user: UserView;
  accessToken: string;
}

function persistAuth(payload: AuthResponse): UserView {
  setAccessToken(payload.accessToken);
  setStoredUser(payload.user);
  return payload.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const existing = getAccessToken();
    const cachedUser = getStoredUser();
    if (existing) setToken(existing);
    if (cachedUser) setUser(cachedUser);

    if (!existing) {
      setReady(true);
      return;
    }

    apiFetch<UserView>('/users/me')
      .then((fresh) => {
        if (cancelled) return;
        setUser(fresh);
        setStoredUser(fresh);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
          clearAccessToken();
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const payload = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    });
    const loggedIn = persistAuth(payload);
    setUser(loggedIn);
    setToken(payload.accessToken);
    return loggedIn;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const payload = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    });
    const registered = persistAuth(payload);
    setUser(registered);
    setToken(payload.accessToken);
    return registered;
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setToken(null);
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await apiFetch<UserView>('/users/me');
    setUser(fresh);
    setStoredUser(fresh);
  }, []);

  const value = useMemo(
    () => ({ user, token, ready, login, register, logout, refresh }),
    [user, token, ready, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
