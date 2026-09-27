import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { auth, requireAuth } from '../auth';
import { HttpError, asyncHandler, parse } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { createSignedDownload, createSignedUpload, storageMode } from '../adapters/storage';

// Self-employment proof uploads. With Supabase keys the browser uploads directly to the private
// "outcome-evidence" bucket through a signed URL; without keys the file is stored inline in
// Postgres (base64, 2 MB cap) so the flow still works end to end.
export const uploadsRouter = Router();

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'];
const kind = z.enum(['UDYAM_CERTIFICATE', 'SHOP_PHOTO', 'UPI_SUMMARY', 'OTHER']);
const meta = z.object({
  kind,
  fileName: z.string().trim().min(1).max(120),
  mimeType: z.string().refine((m) => ALLOWED.includes(m), 'Upload a JPG, PNG, WEBP or PDF file.'),
  sizeBytes: z.number().int().positive().max(MAX_BYTES, 'Files must be 2 MB or smaller.'),
});

const safe = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);

uploadsRouter.post(
  '/sign',
  requireAuth('TRAINEE'),
  asyncHandler(async (req, res) => {
    const m = parse(meta, req.body);
    if (storageMode() === 'DEMO') {
      res.json({ mode: 'INLINE' });
      return;
    }
    const path = `${auth(req).sub}/${Date.now()}-${safe(m.fileName)}`;
    const signed = await createSignedUpload(path);
    res.json({ mode: 'SUPABASE', signedUrl: signed.signedUrl, path: signed.path });
  }),
);

uploadsRouter.post(
  '/complete',
  requireAuth('TRAINEE'),
  asyncHandler(async (req, res) => {
    const body = parse(meta.extend({ path: z.string().min(3).max(300) }), req.body);
    const traineeId = auth(req).sub;
    if (!body.path.startsWith(`${traineeId}/`)) throw new HttpError(403, 'Upload path does not belong to you.');
    const ev = await prisma.evidenceFile.create({ data: { traineeId, kind: body.kind, fileName: body.fileName, mimeType: body.mimeType, sizeBytes: body.sizeBytes, storage: 'SUPABASE', path: body.path } });
    res.json({ id: ev.id, storage: ev.storage });
  }),
);

uploadsRouter.post(
  '/inline',
  requireAuth('TRAINEE'),
  asyncHandler(async (req, res) => {
    const body = parse(meta.extend({ base64: z.string().min(8) }), req.body);
    const bytes = Math.floor((body.base64.length * 3) / 4);
    if (bytes > MAX_BYTES) throw new HttpError(413, 'Files must be 2 MB or smaller.');
    const ev = await prisma.evidenceFile.create({ data: { traineeId: auth(req).sub, kind: body.kind, fileName: body.fileName, mimeType: body.mimeType, sizeBytes: bytes, storage: 'INLINE', data: body.base64 } });
    res.json({ id: ev.id, storage: ev.storage });
  }),
);

uploadsRouter.get(
  '/:id',
  requireAuth('TRAINEE', 'GOVT', 'AGENT'),
  asyncHandler(async (req, res) => {
    const claims = auth(req);
    const ev = await prisma.evidenceFile.findUnique({ where: { id: req.params.id } });
    if (!ev || (claims.role === 'TRAINEE' && ev.traineeId !== claims.sub)) throw new HttpError(404, 'File not found');
    if (claims.role !== 'TRAINEE') await writeAudit(claims, 'VIEW_EVIDENCE_FILE', ev.traineeId, ev.fileName);
    const url = ev.storage === 'SUPABASE' && ev.path ? await createSignedDownload(ev.path) : `data:${ev.mimeType};base64,${ev.data ?? ''}`;
    res.json({ url, fileName: ev.fileName, mimeType: ev.mimeType });
  }),
);
