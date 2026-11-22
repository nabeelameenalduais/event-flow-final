-- Allow the app's anon-key client to use the public "uploads" bucket.
-- The app uses its own session tokens (no Supabase Auth JWT), so policies
-- cannot scope by auth.uid(); access is limited to this one bucket.
-- Run in the Supabase SQL Editor after the base schema.

drop policy if exists "uploads_insert" on storage.objects;
create policy "uploads_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'uploads' and name not like '%/..%');

drop policy if exists "uploads_select" on storage.objects;
create policy "uploads_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'uploads');

drop policy if exists "uploads_delete" on storage.objects;
create policy "uploads_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'uploads');
