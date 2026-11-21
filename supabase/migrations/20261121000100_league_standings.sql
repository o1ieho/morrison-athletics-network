-- League standings (TISSA): each other school's win-loss record, per team
-- (Boys Varsity, Girls JV, ...), entered by an admin from the league's
-- published table. The Broncos' own row isn't stored: the site works it out
-- from our final scores (team_records), so it can't disagree with the scores.
--
-- Safe to run more than once.

create table if not exists public.league_standings (
  season_id text not null references public.seasons (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  opponent_id text not null references public.opponents (id) on delete cascade,
  wins integer not null default 0 check (wins between 0 and 200),
  losses integer not null default 0 check (losses between 0 and 200),
  updated_at timestamptz not null default now(),
  primary key (season_id, team_id, opponent_id)
);

alter table public.league_standings enable row level security;

drop policy if exists "public read" on public.league_standings;
create policy "public read" on public.league_standings for select using (true);
drop policy if exists "admin write" on public.league_standings;
create policy "admin write" on public.league_standings for all using (public.is_admin()) with check (public.is_admin());

grant select on public.league_standings to anon, authenticated;
grant insert, update, delete on public.league_standings to authenticated;
