-- SSN basketball pilot schema.
--
-- Single-school model: every game is one MAT team vs. one opponent. MAT player
-- stats are tracked per athlete; opponents are tracked as team totals only.
-- Scores are derived from game_events by trigger (unless a game is in manual
-- scoring mode), so the operator never types a score.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.ssn_game_status as enum ('scheduled', 'live', 'final', 'postponed', 'canceled');
create type public.ssn_role as enum ('admin', 'stat_operator');
create type public.ssn_team_season_status as enum ('upcoming', 'active', 'completed', 'not_offered');
create type public.ssn_scoring_mode as enum ('live', 'manual');
create type public.ssn_foul_reset as enum ('quarter', 'half');
-- 'team' = the MAT team, 'opponent' = the other team, 'game' = markers like period start/end.
create type public.ssn_side as enum ('team', 'opponent', 'game');
create type public.ssn_event_type as enum (
  'fg2_made', 'fg2_miss',
  'fg3_made', 'fg3_miss',
  'ft_made', 'ft_miss',
  'rebound_off', 'rebound_def',
  'assist', 'steal', 'block', 'turnover', 'foul',
  'timeout',
  'period_start', 'period_end'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.seasons (
  id text primary key,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index seasons_one_active on public.seasons (is_active) where is_active;

create table public.sports (
  id text primary key,
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.teams (
  id text primary key,
  sport_id text not null references public.sports (id),
  slug text not null unique,
  name text not null,
  gender text not null check (gender in ('boys', 'girls', 'coed')),
  level text not null check (level in ('varsity', 'jv')),
  conference text not null default 'TISSA',
  season_status public.ssn_team_season_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.opponents (
  id text primary key,
  name text not null,
  short_name text not null,
  created_at timestamptz not null default now()
);

create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  title text not null,
  bio text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.coach_teams (
  coach_id uuid not null references public.coaches (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  season_id text not null references public.seasons (id) on delete cascade,
  primary key (coach_id, team_id, season_id)
);

create table public.athletes (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  full_name text not null,
  bio text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table public.athlete_seasons (
  athlete_id text not null references public.athletes (id) on delete cascade,
  season_id text not null references public.seasons (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  jersey_number integer check (jersey_number between 0 and 99),
  position text,
  grade text,
  height text,
  primary key (athlete_id, season_id, team_id),
  unique (season_id, team_id, jersey_number)
);

create table public.games (
  id text primary key default gen_random_uuid()::text,
  season_id text not null references public.seasons (id),
  team_id text not null references public.teams (id),
  opponent_id text not null references public.opponents (id),
  is_home boolean not null default true,
  starts_at timestamptz not null,
  location text not null default '',
  status public.ssn_game_status not null default 'scheduled',
  scoring_mode public.ssn_scoring_mode not null default 'live',
  team_score integer not null default 0 check (team_score >= 0),
  opponent_score integer not null default 0 check (opponent_score >= 0),
  -- Rules (per game so a TISSA rule change is a data change, not a code change).
  period_count integer not null default 4 check (period_count between 1 and 4),
  period_length_seconds integer not null default 480 check (period_length_seconds > 0),
  overtime_length_seconds integer not null default 240 check (overtime_length_seconds > 0),
  foul_reset public.ssn_foul_reset not null default 'quarter',
  bonus_threshold integer not null default 5 check (bonus_threshold > 0),
  -- Clock. While running, the live value is clock_seconds_left minus the time
  -- elapsed since clock_anchor_at, so viewers can tick it locally without a
  -- database write every second.
  current_period integer not null default 1 check (current_period >= 1),
  clock_running boolean not null default false,
  clock_seconds_left integer not null default 480 check (clock_seconds_left >= 0),
  clock_anchor_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not clock_running or clock_anchor_at is not null)
);

create index games_team_starts_idx on public.games (team_id, starts_at);
create index games_season_idx on public.games (season_id);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id) on delete cascade,
  side public.ssn_side not null,
  athlete_id text references public.athletes (id) on delete set null,
  event_type public.ssn_event_type not null,
  period integer not null check (period >= 1),
  clock_seconds_left integer not null check (clock_seconds_left >= 0),
  points integer generated always as (
    case event_type
      when 'fg2_made' then 2
      when 'fg3_made' then 3
      when 'ft_made' then 1
      else 0
    end
  ) stored,
  shot_x numeric(5, 4) check (shot_x between 0 and 1),
  shot_y numeric(5, 4) check (shot_y between 0 and 1),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  -- Only MAT events can name a player.
  check (side = 'team' or athlete_id is null),
  -- Period markers belong to the game, everything else to a side.
  check ((side = 'game') = (event_type in ('period_start', 'period_end'))),
  -- Opponents are team totals: scoring, fouls and timeouts only.
  check (side <> 'opponent' or event_type in (
    'fg2_made', 'fg2_miss', 'fg3_made', 'fg3_miss', 'ft_made', 'ft_miss', 'foul', 'timeout'
  )),
  -- A shot spot only makes sense on a field goal, and needs both coordinates.
  check ((shot_x is null) = (shot_y is null)),
  check (shot_x is null or event_type in ('fg2_made', 'fg2_miss', 'fg3_made', 'fg3_miss'))
);

create index game_events_game_idx on public.game_events (game_id, created_at);
create index game_events_athlete_idx on public.game_events (athlete_id) where athlete_id is not null;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null check (category in ('game-day', 'team-news', 'transportation', 'achievement', 'department')),
  summary text not null default '',
  body text not null default '',
  cover_image_url text,
  pinned boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  team_id text references public.teams (id) on delete set null,
  athlete_id text references public.athletes (id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.ssn_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.has_role(roles public.ssn_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = any (roles)
  );
$$;

create function public.can_operate()
returns boolean
language sql
stable
as $$ select public.has_role(array['admin', 'stat_operator']::public.ssn_role[]); $$;

create function public.is_admin()
returns boolean
language sql
stable
as $$ select public.has_role(array['admin']::public.ssn_role[]); $$;

create function public.game_clock_now(g public.games)
returns integer
language sql
stable
as $$
  select case
    when g.clock_running and g.clock_anchor_at is not null then
      greatest(0, g.clock_seconds_left - floor(extract(epoch from (now() - g.clock_anchor_at)))::integer)
    else g.clock_seconds_left
  end;
$$;

create function public.period_length(g public.games, p integer)
returns integer
language sql
immutable
as $$
  select case when p > g.period_count then g.overtime_length_seconds else g.period_length_seconds end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger games_touch_updated_at
before update on public.games
for each row execute function public.touch_updated_at();

-- Fill period / clock from the game's current state when the client omits them,
-- so every event is stamped with server time rather than the operator's device.
create function public.game_events_fill_defaults()
returns trigger
language plpgsql
as $$
declare
  g public.games;
begin
  select * into g from public.games where id = new.game_id;
  if not found then
    raise exception 'Game % does not exist', new.game_id;
  end if;
  if new.period is null then
    new.period := g.current_period;
  end if;
  if new.clock_seconds_left is null then
    new.clock_seconds_left := public.game_clock_now(g);
  end if;
  return new;
end;
$$;

create trigger game_events_fill_defaults
before insert on public.game_events
for each row execute function public.game_events_fill_defaults();

create function public.recompute_game_score(p_game_id text)
returns void
language plpgsql
as $$
begin
  -- Lock the game row so concurrent event writes are summed one at a time.
  perform 1 from public.games where id = p_game_id for update;
  update public.games
  set
    team_score = coalesce((
      select sum(points) from public.game_events
      where game_id = p_game_id and side = 'team' and voided_at is null
    ), 0),
    opponent_score = coalesce((
      select sum(points) from public.game_events
      where game_id = p_game_id and side = 'opponent' and voided_at is null
    ), 0)
  where id = p_game_id and scoring_mode = 'live';
end;
$$;

create function public.game_events_recompute_score()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_game_score(old.game_id);
    return old;
  end if;
  perform public.recompute_game_score(new.game_id);
  if tg_op = 'UPDATE' and old.game_id <> new.game_id then
    perform public.recompute_game_score(old.game_id);
  end if;
  return new;
end;
$$;

create trigger game_events_recompute_score
after insert or update or delete on public.game_events
for each row execute function public.game_events_recompute_score();

-- Switching a game back to live scoring re-derives its score from events.
create function public.games_scoring_mode_changed()
returns trigger
language plpgsql
as $$
begin
  if new.scoring_mode = 'live' and old.scoring_mode = 'manual' then
    perform public.recompute_game_score(new.id);
  end if;
  return new;
end;
$$;

create trigger games_scoring_mode_changed
after update of scoring_mode on public.games
for each row execute function public.games_scoring_mode_changed();

-- ---------------------------------------------------------------------------
-- Operator RPCs (clock and period control use server time)
-- ---------------------------------------------------------------------------

create function public.assert_can_operate()
returns void
language plpgsql
stable
as $$
begin
  if not public.can_operate() then
    raise exception 'Not authorized to operate games' using errcode = '42501';
  end if;
end;
$$;

create function public.clock_start(p_game_id text)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate();
  update public.games
  set clock_running = true, clock_anchor_at = now(), status = 'live'
  where id = p_game_id and not clock_running and clock_seconds_left > 0
  returning * into g;
  if not found then
    select * into g from public.games where id = p_game_id;
  end if;
  return g;
end;
$$;

create function public.clock_stop(p_game_id text)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate();
  update public.games as t
  set clock_seconds_left = public.game_clock_now(t), clock_running = false, clock_anchor_at = null
  where id = p_game_id and clock_running
  returning * into g;
  if not found then
    select * into g from public.games where id = p_game_id;
  end if;
  return g;
end;
$$;

create function public.clock_set(p_game_id text, p_seconds_left integer)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate();
  update public.games
  set
    clock_seconds_left = greatest(0, p_seconds_left),
    clock_anchor_at = case when clock_running then now() else null end
  where id = p_game_id
  returning * into g;
  return g;
end;
$$;

create function public.start_period(p_game_id text, p_period integer)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate();
  select * into g from public.games where id = p_game_id for update;
  if not found then
    raise exception 'Game % does not exist', p_game_id;
  end if;
  update public.games
  set
    current_period = p_period,
    status = 'live',
    clock_running = false,
    clock_anchor_at = null,
    clock_seconds_left = public.period_length(g, p_period)
  where id = p_game_id
  returning * into g;
  insert into public.game_events (game_id, side, event_type, period, clock_seconds_left)
  values (p_game_id, 'game', 'period_start', p_period, g.clock_seconds_left);
  return g;
end;
$$;

create function public.end_period(p_game_id text)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate();
  update public.games
  set clock_running = false, clock_anchor_at = null, clock_seconds_left = 0
  where id = p_game_id
  returning * into g;
  if not found then
    raise exception 'Game % does not exist', p_game_id;
  end if;
  insert into public.game_events (game_id, side, event_type, period, clock_seconds_left)
  values (p_game_id, 'game', 'period_end', g.current_period, 0);
  return g;
end;
$$;

create function public.set_game_status(p_game_id text, p_status public.ssn_game_status)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate();
  update public.games as t
  set
    status = p_status,
    -- Leaving 'live' freezes the clock where it is; staying live leaves it alone.
    clock_seconds_left = case when p_status = 'live' then clock_seconds_left else public.game_clock_now(t) end,
    clock_running = case when p_status = 'live' then clock_running else false end,
    clock_anchor_at = case when p_status = 'live' then clock_anchor_at else null end
  where id = p_game_id
  returning * into g;
  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stats views
-- ---------------------------------------------------------------------------

create view public.player_game_stats with (security_invoker = true) as
select
  e.game_id,
  e.athlete_id,
  sum(e.points)::integer as pts,
  count(*) filter (where e.event_type in ('fg2_made', 'fg3_made'))::integer as fgm,
  count(*) filter (where e.event_type in ('fg2_made', 'fg2_miss', 'fg3_made', 'fg3_miss'))::integer as fga,
  count(*) filter (where e.event_type = 'fg3_made')::integer as fg3m,
  count(*) filter (where e.event_type in ('fg3_made', 'fg3_miss'))::integer as fg3a,
  count(*) filter (where e.event_type = 'ft_made')::integer as ftm,
  count(*) filter (where e.event_type in ('ft_made', 'ft_miss'))::integer as fta,
  count(*) filter (where e.event_type = 'rebound_off')::integer as oreb,
  count(*) filter (where e.event_type = 'rebound_def')::integer as dreb,
  count(*) filter (where e.event_type in ('rebound_off', 'rebound_def'))::integer as reb,
  count(*) filter (where e.event_type = 'assist')::integer as ast,
  count(*) filter (where e.event_type = 'steal')::integer as stl,
  count(*) filter (where e.event_type = 'block')::integer as blk,
  count(*) filter (where e.event_type = 'turnover')::integer as tov,
  count(*) filter (where e.event_type = 'foul')::integer as pf
from public.game_events e
where e.voided_at is null and e.side = 'team' and e.athlete_id is not null
group by e.game_id, e.athlete_id;

-- Season totals over final games only, so averages don't swing mid-game.
-- GP counts games where the player recorded at least one stat (no minutes tracking yet).
create view public.player_season_stats with (security_invoker = true) as
select
  g.season_id,
  g.team_id,
  s.athlete_id,
  count(*)::integer as gp,
  sum(s.pts)::integer as pts,
  sum(s.fgm)::integer as fgm,
  sum(s.fga)::integer as fga,
  sum(s.fg3m)::integer as fg3m,
  sum(s.fg3a)::integer as fg3a,
  sum(s.ftm)::integer as ftm,
  sum(s.fta)::integer as fta,
  sum(s.oreb)::integer as oreb,
  sum(s.dreb)::integer as dreb,
  sum(s.reb)::integer as reb,
  sum(s.ast)::integer as ast,
  sum(s.stl)::integer as stl,
  sum(s.blk)::integer as blk,
  sum(s.tov)::integer as tov,
  sum(s.pf)::integer as pf
from public.player_game_stats s
join public.games g on g.id = s.game_id
where g.status = 'final'
group by g.season_id, g.team_id, s.athlete_id;

create view public.team_records with (security_invoker = true) as
select
  t.id as team_id,
  se.id as season_id,
  count(g.id) filter (where g.team_score > g.opponent_score)::integer as wins,
  count(g.id) filter (where g.team_score < g.opponent_score)::integer as losses,
  count(g.id) filter (where g.team_score = g.opponent_score)::integer as ties
from public.teams t
cross join public.seasons se
left join public.games g on g.team_id = t.id and g.season_id = se.id and g.status = 'final'
group by t.id, se.id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.sports enable row level security;
alter table public.teams enable row level security;
alter table public.opponents enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_teams enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_seasons enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.announcements enable row level security;
alter table public.user_roles enable row level security;

-- Public reads. Voided events stay readable so viewers receive undo updates in
-- realtime; clients filter them out.
create policy "public read" on public.seasons for select using (true);
create policy "public read" on public.sports for select using (true);
create policy "public read" on public.teams for select using (true);
create policy "public read" on public.opponents for select using (true);
create policy "public read" on public.coaches for select using (true);
create policy "public read" on public.coach_teams for select using (true);
create policy "public read" on public.athletes for select using (true);
create policy "public read" on public.athlete_seasons for select using (true);
create policy "public read" on public.games for select using (true);
create policy "public read" on public.game_events for select using (true);
create policy "public read published" on public.announcements for select using (
  (published_at is not null and published_at <= now() and (expires_at is null or expires_at > now()))
  or public.is_admin()
);
create policy "read own roles" on public.user_roles for select using (user_id = auth.uid() or public.is_admin());

-- Admin writes.
create policy "admin write" on public.seasons for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.sports for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.teams for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.opponents for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.coaches for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.coach_teams for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.athletes for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.athlete_seasons for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.games for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.game_events for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.announcements for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.user_roles for all using (public.is_admin()) with check (public.is_admin());

-- Stat operators run games: update game state and add/void events.
create policy "operator update games" on public.games for update
  using (public.can_operate()) with check (public.can_operate());
create policy "operator insert events" on public.game_events for insert
  with check (public.can_operate());
create policy "operator update events" on public.game_events for update
  using (public.can_operate()) with check (public.can_operate());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.games, public.game_events;
