-- Profile avatars are stored in a public Supabase Storage bucket and referenced
-- from the user profile row. Each account owns exactly one object, stored under
-- its own user id prefix, so the storage policies can isolate accounts.
--
-- No service-role key is involved: the browser uploads through the Storage API
-- with the publishable key, and Row Level Security keeps every account inside
-- its own folder. The profile row is updated by the client under the existing
-- "Users manage their profile" policy.

alter table public.profiles add column if not exists avatar_path text;

-- The avatar always lives under the owner's own user id.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_avatar_path_owner'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_avatar_path_owner
      check (avatar_path is null or avatar_path like user_id::text || '/%');
  end if;
end;
$$;

-- Public bucket: avatars are readable by anyone (including signed-out visitors),
-- but only the owner can write. Images only, up to 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp']
where not exists (select 1 from storage.buckets where id = 'avatars');

-- Hosted Supabase owns storage.objects as supabase_storage_admin and enables
-- RLS by default; ALTER TABLE / GRANT on it now fails with 42501. The Storage
-- API manages its own grants, so only the policies below belong here.

-- Everyone can read avatars.
drop policy if exists "Anyone can read avatars" on storage.objects;
create policy "Anyone can read avatars"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

-- A signed-in account can only write inside its own folder.
drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their own avatar" on storage.objects;
create policy "Users delete their own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- The client writes profiles.avatar_path directly under the existing policy.
grant select, insert, update, delete on public.profiles to authenticated;
revoke all on public.profiles from anon;
