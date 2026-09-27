import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, Role, SessionUser } from '@kaushalsetu/shared';
import { api, setUnauthorizedHandler, tokenStore } from './api';

interface AuthContextValue {
  user: SessionUser | null;
  loginDemo: (role: Exclude<Role, 'TRAINEE'>) => Promise<SessionUser>;
  loginPassword: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readUser(): SessionUser | null {
  const raw = tokenStore.getUser();
  if (!raw || !tokenStore.get()) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export const HOME_BY_ROLE: Record<Role, string> = {
  GOVT: '/govt',
  PROVIDER: '/provider',
  AGENT: '/agent',
  TRAINEE: '/portal',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(readUser);
  const qc = useQueryClient();

  const apply = useCallback(
    (res: AuthResponse) => {
      tokenStore.set(res.token);
      tokenStore.setUser(JSON.stringify(res.user));
      qc.clear();
      setUser(res.user);
      return res.user;
    },
    [qc],
  );

  const logout = useCallback(() => {
    tokenStore.set(null);
    tokenStore.setUser(null);
    qc.clear();
    setUser(null);
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.set(null);
      tokenStore.setUser(null);
      setUser(null);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loginDemo: async (role) => apply(await api<AuthResponse>('/auth/demo', { method: 'POST', body: { role }, auth: 'none' })),
      loginPassword: async (email, password) => apply(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: 'none' })),
      logout,
    }),
    [user, apply, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
