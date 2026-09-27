import type { AdapterStatus } from '@kaushalsetu/shared';
import { whatsappMode } from './whatsapp';
import { gstinMode } from './gstin';
import { llmEngine, llmMode } from './llm';
import { epfoMode } from './epfo';
import { bhashiniMode } from './bhashini';
import { storageMode } from './storage';

export function adapterStatuses(): AdapterStatus[] {
  return [
    { key: 'whatsapp', label: 'WhatsApp', mode: whatsappMode(), detail: whatsappMode() === 'LIVE' ? 'Meta WhatsApp Cloud API' : 'In-app chat simulator, same bot engine' },
    { key: 'gstin', label: 'GSTIN', mode: gstinMode(), detail: gstinMode() === 'LIVE' ? 'External GST verification API' : 'Internal employer registry with checksum validation' },
    { key: 'llm', label: 'AI summary', mode: llmMode(), detail: llmEngine() },
    { key: 'epfo', label: 'EPFO', mode: epfoMode(), detail: 'EPFO Signal Simulator (no public API)' },
    { key: 'bhashini', label: 'Bhashini', mode: bhashiniMode(), detail: bhashiniMode() === 'LIVE' ? 'Bhashini inference pipeline' : 'Pre-translated en/hi/mr strings' },
    { key: 'storage', label: 'Storage', mode: storageMode(), detail: storageMode() === 'LIVE' ? 'Supabase Storage, signed URLs' : 'Inline Postgres storage (keyless)' },
    { key: 'realtime', label: 'Live updates', mode: 'DEMO', detail: 'TanStack Query polling every 5 s; Supabase Realtime when the web app has anon keys' },
  ];
}
