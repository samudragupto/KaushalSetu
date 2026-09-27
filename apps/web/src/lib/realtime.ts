import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const realtimeEnabled = Boolean(URL_ && ANON);

// Optional: when the Supabase anon key is configured, database changes on EmploymentRecord and
// FollowUp invalidate queries immediately. 5-second polling stays on either way.
export function useRealtimeInvalidation() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!realtimeEnabled) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import('@supabase/supabase-js').then(({ createClient }) => {
      if (cancelled) return;
      const client = createClient(URL_ as string, ANON as string, { auth: { persistSession: false } });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const invalidate = () => {
        clearTimeout(timer);
        timer = setTimeout(() => qc.invalidateQueries(), 400);
      };
      const channel = client
        .channel('kaushalsetu-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'EmploymentRecord' }, invalidate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'FollowUp' }, invalidate)
        .subscribe();
      cleanup = () => {
        clearTimeout(timer);
        client.removeChannel(channel);
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [qc]);
}
