create table if not exists public.football_archives (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"leagues":[],"clubs":[],"persons":[],"cards":[]}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.football_archive_versions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null,
  created_at timestamptz not null default now()
);

alter table public.football_archives enable row level security;
alter table public.football_archive_versions enable row level security;

drop policy if exists "archive owner access" on public.football_archives;
create policy "archive owner access"
on public.football_archives for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "archive owner history" on public.football_archive_versions;
create policy "archive owner history"
on public.football_archive_versions for select to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.football_archives to authenticated;
grant select on public.football_archive_versions to authenticated;

create or replace function public.save_football_archive_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.football_archive_versions (user_id, data, revision)
  values (old.user_id, old.data, old.revision);

  new.revision := old.revision + 1;
  new.updated_at := now();

  delete from public.football_archive_versions
  where id in (
    select id
    from public.football_archive_versions
    where user_id = old.user_id
    order by created_at desc
    offset 50
  );

  return new;
end;
$$;

drop trigger if exists save_version_before_update on public.football_archives;
create trigger save_version_before_update
before update on public.football_archives
for each row execute function public.save_football_archive_version();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  false,
  10485760,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users can view own football photos" on storage.objects;
create policy "users can view own football photos"
on storage.objects for select to authenticated
using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users can upload own football photos" on storage.objects;
create policy "users can upload own football photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users can update own football photos" on storage.objects;
create policy "users can update own football photos"
on storage.objects for update to authenticated
using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users can delete own football photos" on storage.objects;
create policy "users can delete own football photos"
on storage.objects for delete to authenticated
using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
