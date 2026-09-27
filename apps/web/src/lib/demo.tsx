import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AdapterStatus } from '@kaushalsetu/shared';
import { api } from './api';

interface PublicConfig {
  demoMode: boolean;
  adapters: AdapterStatus[];
}

interface DemoContextValue {
  serverDemo: boolean;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  adapters: AdapterStatus[];
}

const DemoContext = createContext<DemoContextValue | null>(null);
const KEY = 'ks.demoMode';

export function DemoProvider({ children }: { children: ReactNode }) {
  const config = useQuery({ queryKey: ['public-config'], queryFn: () => api<PublicConfig>('/public/config', { auth: 'none' }), staleTime: 60_000 });
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const serverDemo = config.data?.demoMode ?? false;
  useEffect(() => {
    try {
      localStorage.setItem(KEY, enabled ? 'on' : 'off');
    } catch {
      // Preference is kept for this tab only.
    }
  }, [enabled]);
  const value = useMemo(
    () => ({ serverDemo, enabled: serverDemo && enabled, setEnabled: setEnabledState, adapters: config.data?.adapters ?? [] }),
    [serverDemo, enabled, config.data],
  );
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo outside DemoProvider');
  return ctx;
}
