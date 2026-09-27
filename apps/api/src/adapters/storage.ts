import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdapterMode } from '@kaushalsetu/shared';
import { env } from '../env';

let client: SupabaseClient | null = null;

export const storageMode = (): AdapterMode => (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? 'LIVE' : 'DEMO');

function supabase(): SupabaseClient {
  if (!client) client = createClient(env.SUPABASE_URL ?? '', env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } });
  return client;
}

// Signed upload URL: the browser PUTs the file straight to Supabase Storage; the service role
// key never leaves the API.
export async function createSignedUpload(path: string): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await supabase().storage.from(env.SUPABASE_STORAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Storage signing failed: ${error?.message ?? 'unknown error'}`);
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

export async function createSignedDownload(path: string, seconds = 300): Promise<string> {
  const { data, error } = await supabase().storage.from(env.SUPABASE_STORAGE_BUCKET).createSignedUrl(path, seconds);
  if (error || !data) throw new Error(`Storage signing failed: ${error?.message ?? 'unknown error'}`);
  return data.signedUrl;
}
