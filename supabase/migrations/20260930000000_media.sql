-- Media: photos (uploaded to Storage) and videos (YouTube links) for the
-- home page grid and the Media page. Anyone can view; only admins can add or
-- remove.

create table public.media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo', 'video')),
  title text not null default '',
  -- Full-size photo URL, or the YouTube link for a video.
  url text not null,
  -- Smaller image for grids (uploaded thumbnail, or YouTube's).
  thumbnail_url text,
  -- Storage paths of uploaded files, so deleting the item deletes the files.
  storage_paths text[] not null default '{}',
  width integer,
  height integer,
  team_id text references public.teams (id) on delete set null,
  game_id text references public.games (id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index media_created_idx on public.media (created_at desc);

alter table public.media enable row level security;

create policy "public read" on public.media for select using (true);
create policy "admin write" on public.media for all using (public.is_admin()) with check (public.is_admin());

grant select on public.media to anon, authenticated;
grant insert, update, delete on public.media to authenticated;

-- Public bucket: files are served by URL to everyone. Only admins can upload
-- or delete, and only images up to 10 MB (the uploader shrinks photos first).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admins upload media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy "admins delete media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
