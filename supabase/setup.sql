-- Run once in the Supabase SQL editor, after `prisma migrate deploy` has created the tables.

-- 1. Lock the application tables away from Supabase's public API roles.
--    Prisma creates tables in the public schema, which Supabase exposes through PostgREST and
--    Realtime to the `anon` and `authenticated` roles. The anon key is public by design, so
--    without this block anyone holding it could read trainee records. The API connects as the
--    `postgres` role through the pooler and is unaffected (it bypasses RLS).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 2. Private storage bucket for self-employment proof (Udyam certificates, shop photos, UPI
--    summaries). Browsers upload and download only through short-lived signed URLs minted by
--    the API with the service role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outcome-evidence', 'outcome-evidence', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'])
on conflict (id) do nothing;

-- 3. Realtime needs no table publication. The API sends a Broadcast message on the public
--    channel "kaushalsetu-live" after each write; the message carries only a version number,
--    never row data, and the web app uses it to refresh immediately instead of waiting for the
--    next 5-second poll.
