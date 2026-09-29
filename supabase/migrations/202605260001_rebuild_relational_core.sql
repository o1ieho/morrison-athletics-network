create type public.ssn_game_status as enum ('scheduled', 'live', 'final', 'postponed', 'canceled');
create type public.ssn_role as enum ('admin', 'content_editor', 'stat_operator');
create type public.ssn_event_type as enum (
  'free_throw_made',
  'field_goal_made',
  'three_point_made',
  'rebound',
  'assist',
  'steal',
  'block',
  'foul',
  'turnover'
);

create table public.seasons (
  id text primary key,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sports (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.teams (
  id text primary key,
  sport_id text not null references public.sports(id),
  slug text not null unique,
  name text not null,
  city text not null default '',
  level text not null,
  conference text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  title text not null,
  photo_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.coach_teams (
  coach_id uuid not null references public.coaches(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  season_id text references public.seasons(id),
  primary key (coach_id, team_id, season_id)
);

create table public.athletes (
  id text primary key,
  slug text not null unique,
  full_name text not null,
  profile_image_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.athlete_seasons (
  athlete_id text not null references public.athletes(id) on delete cascade,
  season_id text not null references public.seasons(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  jersey_number integer,
  position text,
  grade text,
  height text,
  weight text,
  primary key (athlete_id, season_id, team_id)
);

create table public.games (
  id text primary key,
  season_id text not null references public.seasons(id),
  sport_id text not null references public.sports(id),
  home_team_id text not null references public.teams(id),
  away_team_id text not null references public.teams(id),
  status public.ssn_game_status not null default 'scheduled',
  starts_at timestamptz not null,
  location text not null default '',
  home_score integer not null default 0,
  away_score integer not null default 0,
  current_period integer not null default 1,
  clock text not null default '12:00',
  created_at timestamptz not null default now()
);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  team_id text not null references public.teams(id),
  athlete_id text references public.athletes(id),
  event_type public.ssn_event_type not null,
  period integer not null,
  clock text not null,
  points integer not null default 0,
  description text not null default '',
  shot_x numeric,
  shot_y numeric,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  summary text not null default '',
  body text not null default '',
  cover_image_url text,
  pinned boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  team_id text references public.teams(id),
  athlete_id text references public.athletes(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  media_type text not null,
  url text not null,
  caption text not null default '',
  featured boolean not null default false,
  team_id text references public.teams(id),
  athlete_id text references public.athletes(id),
  game_id text references public.games(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.standings (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.seasons(id),
  team_id text not null references public.teams(id),
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  notes text,
  updated_at timestamptz not null default now(),
  unique (season_id, team_id)
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.ssn_role not null,
  team_id text references public.teams(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role, team_id)
);

alter table public.seasons enable row level security;
alter table public.sports enable row level security;
alter table public.teams enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_teams enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_seasons enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.announcements enable row level security;
alter table public.media_assets enable row level security;
alter table public.standings enable row level security;
alter table public.user_roles enable row level security;

create policy "Public read seasons" on public.seasons for select to anon, authenticated using (true);
create policy "Public read sports" on public.sports for select to anon, authenticated using (true);
create policy "Public read teams" on public.teams for select to anon, authenticated using (true);
create policy "Public read coaches" on public.coaches for select to anon, authenticated using (true);
create policy "Public read coach teams" on public.coach_teams for select to anon, authenticated using (true);
create policy "Public read athletes" on public.athletes for select to anon, authenticated using (true);
create policy "Public read athlete seasons" on public.athlete_seasons for select to anon, authenticated using (true);
create policy "Public read games" on public.games for select to anon, authenticated using (true);
create policy "Public read game events" on public.game_events for select to anon, authenticated using (voided_at is null);
create policy "Public read published announcements" on public.announcements for select to anon, authenticated using (
  published_at is not null and published_at <= now() and (expires_at is null or expires_at > now())
);
create policy "Public read media" on public.media_assets for select to anon, authenticated using (true);
create policy "Public read standings" on public.standings for select to anon, authenticated using (true);

create policy "Authenticated manage seasons" on public.seasons for all to authenticated using (true) with check (true);
create policy "Authenticated manage sports" on public.sports for all to authenticated using (true) with check (true);
create policy "Authenticated manage teams" on public.teams for all to authenticated using (true) with check (true);
create policy "Authenticated manage coaches" on public.coaches for all to authenticated using (true) with check (true);
create policy "Authenticated manage coach teams" on public.coach_teams for all to authenticated using (true) with check (true);
create policy "Authenticated manage athletes" on public.athletes for all to authenticated using (true) with check (true);
create policy "Authenticated manage athlete seasons" on public.athlete_seasons for all to authenticated using (true) with check (true);
create policy "Authenticated manage games" on public.games for all to authenticated using (true) with check (true);
create policy "Authenticated manage game events" on public.game_events for all to authenticated using (true) with check (true);
create policy "Authenticated manage announcements" on public.announcements for all to authenticated using (true) with check (true);
create policy "Authenticated manage media" on public.media_assets for all to authenticated using (true) with check (true);
create policy "Authenticated manage standings" on public.standings for all to authenticated using (true) with check (true);
create policy "Users can read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_events;
