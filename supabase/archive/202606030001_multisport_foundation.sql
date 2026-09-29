do $$ begin
  create type public.ssn_team_season_status as enum ('upcoming', 'active', 'completed', 'not_offered');
exception
  when duplicate_object then null;
end $$;

alter table public.sports
  add column if not exists slug text,
  add column if not exists season text not null default 'year-round',
  add column if not exists summary text not null default '';

update public.sports set slug = id where slug is null;

alter table public.sports
  alter column slug set not null;

create unique index if not exists sports_slug_key on public.sports (slug);

alter table public.teams
  add column if not exists gender text,
  add column if not exists season_status public.ssn_team_season_status not null default 'active';

grant select on public.sports, public.teams, public.games, public.announcements, public.media_assets to anon, authenticated;
grant insert, update, delete on public.sports, public.teams to authenticated;

insert into public.sports (id, slug, name, season, summary) values
  ('basketball', 'basketball', 'Basketball', 'winter', 'Winter Broncos basketball schedules, rosters, live games, and box-score coverage.'),
  ('soccer', 'soccer', 'Soccer', 'fall', 'Boys fall soccer and girls spring soccer team pages, schedules, and results.'),
  ('volleyball', 'volleyball', 'Volleyball', 'fall', 'Girls fall volleyball and boys spring volleyball match schedules, rosters, and updates.')
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  season = excluded.season,
  summary = excluded.summary;

insert into public.teams (id, sport_id, slug, name, city, level, gender, conference, season_status) values
  ('MAT-BBB-V', 'basketball', 'varsity-boys-basketball', 'Broncos', 'Morrison', 'Varsity', 'boys', 'TISSA', 'active'),
  ('MAT-GBB-V', 'basketball', 'varsity-girls-basketball', 'Broncos', 'Morrison', 'Varsity', 'girls', 'TISSA', 'active'),
  ('MAT-BSOC-V', 'soccer', 'varsity-boys-soccer', 'Broncos', 'Morrison', 'Varsity', 'boys', 'TISSA', 'completed'),
  ('MAT-GSOC-V', 'soccer', 'varsity-girls-soccer', 'Broncos', 'Morrison', 'Varsity', 'girls', 'TISSA', 'upcoming'),
  ('MAT-GVB-V', 'volleyball', 'varsity-girls-volleyball', 'Broncos', 'Morrison', 'Varsity', 'girls', 'TISSA', 'completed'),
  ('MAT-BVB-V', 'volleyball', 'varsity-boys-volleyball', 'Broncos', 'Morrison', 'Varsity', 'boys', 'TISSA', 'upcoming')
on conflict (id) do update set
  sport_id = excluded.sport_id,
  slug = excluded.slug,
  name = excluded.name,
  city = excluded.city,
  level = excluded.level,
  gender = excluded.gender,
  conference = excluded.conference,
  season_status = excluded.season_status;
