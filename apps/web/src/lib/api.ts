// The single HTTP client for the web app. Every request goes through here so the API base URL
// (VITE_API_URL, the Render service) is applied in one place and never hardcoded in components.

export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const TOKEN_KEY = 'ks.token';
const USER_KEY = 'ks.user';
const TRAINEE_TOKEN_KEY = 'ks.trainee.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private mode; the session then lasts for the tab only.
  }
}

export const tokenStore = {
  get: () => read(TOKEN_KEY),
  set: (token: string | null) => write(TOKEN_KEY, token),
  getUser: () => read(USER_KEY),
  setUser: (user: string | null) => write(USER_KEY, user),
  getTrainee: () => read(TRAINEE_TOKEN_KEY),
  setTrainee: (token: string | null) => write(TRAINEE_TOKEN_KEY, token),
};

export type Auth = 'staff' | 'trainee' | 'none' | { bearer: string };

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: Auth;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}/api${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const auth = opts.auth ?? 'staff';
  const token = typeof auth === 'object' ? auth.bearer : auth === 'staff' ? tokenStore.get() : auth === 'trainee' ? tokenStore.getTrainee() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method: opts.method ?? 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: opts.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the KaushalSetu server. It may be waking up; try again in a few seconds.');
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    if (res.status === 401 && auth === 'staff' && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, message, (data as { details?: unknown } | null)?.details);
  }
  return data as T;
}

export function fieldError(err: unknown, field: string): string | null {
  if (!(err instanceof ApiError)) return null;
  const d = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return d?.fieldErrors?.[field]?.[0] ?? null;
}
