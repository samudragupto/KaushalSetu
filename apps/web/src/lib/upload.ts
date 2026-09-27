import { api, type Auth } from './api';

export type EvidenceKind = 'UDYAM_CERTIFICATE' | 'SHOP_PHOTO' | 'UPI_SUMMARY' | 'OTHER';

const MAX_BYTES = 2 * 1024 * 1024;

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

// Uploads proof of self-employment. With Supabase configured on the API, the browser PUTs the file
// directly to a signed URL in the private bucket; otherwise the API stores it inline.
export async function uploadEvidence(file: File, kind: EvidenceKind, auth: Auth): Promise<{ id: string; storage: string }> {
  if (file.size > MAX_BYTES) throw new Error('Files must be 2 MB or smaller.');
  const mimeType = file.type || 'application/octet-stream';
  const meta = { kind, fileName: file.name, mimeType, sizeBytes: file.size };
  const sign = await api<{ mode: 'SUPABASE' | 'INLINE'; signedUrl?: string; path?: string }>('/uploads/sign', { method: 'POST', body: meta, auth });
  if (sign.mode === 'SUPABASE' && sign.signedUrl && sign.path) {
    const res = await fetch(sign.signedUrl, { method: 'PUT', headers: { 'Content-Type': mimeType, 'x-upsert': 'false' }, body: file });
    if (!res.ok) throw new Error('Upload to storage failed. Try again.');
    return api('/uploads/complete', { method: 'POST', body: { ...meta, path: sign.path }, auth });
  }
  return api('/uploads/inline', { method: 'POST', body: { ...meta, base64: await toBase64(file) }, auth });
}
