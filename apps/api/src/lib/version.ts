// Monotonic counter bumped by every write path. The analytics cache is keyed on it, so the
// dashboard's 5-second poll returns fresh numbers immediately after a bot reply or approval.
let version = 1;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

export function dataVersion(): number {
  return version;
}

export function bumpVersion(): number {
  version += 1;
  scheduleBroadcast();
  return version;
}

// Optional instant refresh: when Supabase is configured, tell connected browsers that data
// changed via a Realtime Broadcast on "kaushalsetu-live". The payload is only the version
// number; no row data leaves the API this way. Throttled to one message per second.
function scheduleBroadcast() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    fetch(`${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: 'kaushalsetu-live', event: 'changed', payload: { version } }] }),
      signal: AbortSignal.timeout(4000),
    }).catch(() => {
      // Polling still refreshes every client within 5 seconds.
    });
  }, 1000);
}
