import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DashboardFilters } from '@kaushalsetu/shared';

const KEYS: (keyof DashboardFilters)[] = ['district', 'sector', 'course', 'provider', 'gender', 'socialCategory', 'ageBand', 'cohortMonth', 'asOf'];

// Dashboard filters live in the URL so a filtered view can be shared or refreshed.
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => {
    const f: DashboardFilters = {};
    for (const k of KEYS) {
      const v = params.get(k);
      if (v) f[k] = v;
    }
    return f;
  }, [params]);

  const setFilter = useCallback(
    (key: keyof DashboardFilters, value: string | undefined) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          if (key === 'sector' && value) {
            const course = next.get('course');
            if (course) next.delete('course');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setMany = useCallback(
    (patch: Partial<DashboardFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams();
        const asOf = prev.get('asOf');
        if (asOf) next.set('asOf', asOf);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const active = KEYS.filter((k) => k !== 'asOf' && filters[k]).length;
  return { filters, setFilter, setMany, clear, active };
}

export function toQuery(f: DashboardFilters): Record<string, string | undefined> {
  return { ...f };
}
