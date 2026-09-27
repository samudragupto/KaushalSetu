import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const realtimeEnabled = Boolean(URL_ && ANON);

// Optional: with the Supabase anon key configured, a Realtime Broadcast from the API
// ("kaushalsetu-live", payload = data version only) triggers an immediate refetch.
// 5-second polling stays on either way, so this only shortens the delay.
export function useRealtimeInvalidation() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!realtimeEnabled) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import('@supabase/supabase-js').then(({ createClient }) => {
      if (cancelled) return;
      const client = createClient(URL_ as string, ANON as string, { auth: { persistSession: false } });
      const channel = client
        .channel('kaushalsetu-live')
        .on('broadcast', { event: 'changed' }, () => {
          qc.invalidateQueries();
        })
        .subscribe();
      cleanup = () => {
        client.removeChannel(channel);
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [qc]);
}
