-- Database tests for the pilot schema. Run against a database built by
-- scripts/local-db.sh (via `npm run test:db`). Everything runs in one
-- transaction that is rolled back, so the demo data is left untouched.

\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-00000000000b', 'operator@test'),
  ('00000000-0000-0000-0000-00000000000c', 'nobody@test');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', 'stat_operator');

insert into public.games (id, season_id, team_id, opponent_id, starts_at)
values ('t-game', '2026-27', 'bbb-v', 'demo-tigers', now());

create function pg_temp.act_as(who text) returns void language plpgsql as $$
begin
  if who = 'anon' then
    perform set_config('request.jwt.claim.sub', '', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claim.sub', case who
      when 'admin' then '00000000-0000-0000-0000-00000000000a'
      when 'operator' then '00000000-0000-0000-0000-00000000000b'
      else '00000000-0000-0000-0000-00000000000c' end, true);
    execute 'set local role authenticated';
  end if;
end $$;

create function pg_temp.expect_error(statement text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok  %', label;
    return;
  end;
  raise exception 'FAIL %: statement succeeded but should have failed', label;
end $$;

create function pg_temp.check(condition boolean, label text) returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

grant execute on function pg_temp.act_as(text), pg_temp.expect_error(text, text), pg_temp.check(boolean, text) to anon, authenticated;

-- Permissions -----------------------------------------------------------------

select pg_temp.act_as('anon');
select pg_temp.expect_error(
  $$insert into public.game_events (game_id, side, athlete_id, event_type) values ('t-game', 'team', 'austin-dam', 'fg2_made')$$,
  'anon cannot add events');
select pg_temp.expect_error($$select public.clock_start('t-game')$$, 'anon cannot start the clock');
select pg_temp.check((select count(*) from public.games where id = 't-game') = 1, 'anon can read games');
reset role;

select pg_temp.act_as('nobody');
select pg_temp.expect_error(
  $$insert into public.game_events (game_id, side, athlete_id, event_type) values ('t-game', 'team', 'austin-dam', 'fg2_made')$$,
  'signed-in user without a role cannot add events');
select pg_temp.expect_error($$select public.start_period('t-game', 1)$$, 'signed-in user without a role cannot start a period');
reset role;

select pg_temp.act_as('operator');
do $$
declare
  changed integer;
begin
  -- RLS filters the row out rather than raising, so assert nothing changed.
  update public.teams set name = 'x' where id = 'bbb-v';
  get diagnostics changed = row_count;
  perform pg_temp.check(changed = 0, 'operator cannot edit teams');
  delete from public.games where id = 't-game';
  get diagnostics changed = row_count;
  perform pg_temp.check(changed = 0, 'operator cannot delete games');
end $$;
reset role;

-- Periods, clock and event defaults ------------------------------------------

select pg_temp.act_as('operator');
select public.start_period('t-game', 1);
select pg_temp.check((select status = 'live' and clock_seconds_left = 480 and current_period = 1 from public.games where id = 't-game'),
  'start_period sets live, Q1, 8:00');
select pg_temp.check((select count(*) = 1 from public.game_events where game_id = 't-game' and event_type = 'period_start'),
  'start_period logs a period_start event');

select public.clock_start('t-game');
select pg_temp.check((select clock_running from public.games where id = 't-game'), 'clock_start runs the clock');
reset role;
-- Pretend 30 seconds passed since the clock started.
update public.games set clock_anchor_at = clock_anchor_at - interval '30 seconds' where id = 't-game';
select pg_temp.act_as('operator');

insert into public.game_events (game_id, side, athlete_id, event_type, shot_x, shot_y)
values ('t-game', 'team', 'austin-dam', 'fg3_made', 0.1, 0.3);
select pg_temp.check((select period = 1 and clock_seconds_left = 450 from public.game_events where game_id = 't-game' and event_type = 'fg3_made'),
  'event without period/clock is stamped Q1 7:30 from server time');

select public.clock_stop('t-game');
select pg_temp.check((select not clock_running and clock_seconds_left = 450 and clock_anchor_at is null from public.games where id = 't-game'),
  'clock_stop freezes the clock at 7:30');

select public.clock_set('t-game', 125);
select pg_temp.check((select clock_seconds_left = 125 from public.games where id = 't-game'), 'clock_set adjusts a stopped clock');

select public.end_period('t-game');
select pg_temp.check((select clock_seconds_left = 0 from public.games where id = 't-game'), 'end_period zeroes the clock');

select public.start_period('t-game', 5);
select pg_temp.check((select clock_seconds_left = 240 and current_period = 5 from public.games where id = 't-game'),
  'overtime uses the overtime length (4:00)');

-- Scoring --------------------------------------------------------------------

select pg_temp.check((select team_score = 3 and opponent_score = 0 from public.games where id = 't-game'), 'score derived from events (3-0)');

insert into public.game_events (game_id, side, event_type) values ('t-game', 'opponent', 'fg2_made');
insert into public.game_events (game_id, side, athlete_id, event_type) values ('t-game', 'team', 'kyan-cheng', 'ft_made');
insert into public.game_events (game_id, side, athlete_id, event_type) values ('t-game', 'team', 'kyan-cheng', 'ft_miss');
select pg_temp.check((select team_score = 4 and opponent_score = 2 from public.games where id = 't-game'), 'misses score nothing (4-2)');

update public.game_events set voided_at = now() where game_id = 't-game' and event_type = 'fg3_made';
select pg_temp.check((select team_score = 1 from public.games where id = 't-game'), 'voiding a made three removes 3 points');

select pg_temp.expect_error(
  $$insert into public.game_events (game_id, side, event_type) values ('t-game', 'opponent', 'assist')$$,
  'opponent events are team totals only (no assists)');
select pg_temp.expect_error(
  $$insert into public.game_events (game_id, side, athlete_id, event_type) values ('t-game', 'opponent', 'austin-dam', 'fg2_made')$$,
  'opponent events cannot name a MAT player');
select pg_temp.expect_error(
  $$insert into public.game_events (game_id, side, athlete_id, event_type, shot_x, shot_y) values ('t-game', 'team', 'austin-dam', 'rebound_def', 0.5, 0.5)$$,
  'only field goals carry a shot spot');
select pg_temp.expect_error(
  $$insert into public.game_events (game_id, side, athlete_id, event_type, shot_x, shot_y) values ('t-game', 'team', 'austin-dam', 'fg2_made', 1.5, 0.5)$$,
  'shot spot must be within 0..1');
reset role;

-- Manual scoring mode ----------------------------------------------------------

select pg_temp.act_as('admin');
update public.games set scoring_mode = 'manual', team_score = 60, opponent_score = 50 where id = 't-game';
insert into public.game_events (game_id, side, athlete_id, event_type) values ('t-game', 'team', 'austin-dam', 'fg2_made');
select pg_temp.check((select team_score = 60 from public.games where id = 't-game'), 'manual scores are not overwritten by events');
update public.games set scoring_mode = 'live' where id = 't-game';
select pg_temp.check((select team_score = 3 and opponent_score = 2 from public.games where id = 't-game'),
  'switching back to live re-derives the score (3-2)');
reset role;

-- Public visibility ------------------------------------------------------------

select pg_temp.act_as('anon');
select pg_temp.check((select count(*) = 1 from public.game_events where game_id = 't-game' and voided_at is not null),
  'anon can see voided events (so realtime delivers undo)');
select pg_temp.check((select count(*) >= 1 from public.player_game_stats where game_id = 't-game'), 'anon can read player_game_stats');
reset role;

-- Stats views ----------------------------------------------------------------

select pg_temp.check((
  select pts = 2 and fgm = 1 and fga = 1 and fg3a = 0 from public.player_game_stats
  where game_id = 't-game' and athlete_id = 'austin-dam'
), 'player_game_stats ignores voided events');
select pg_temp.check((
  select ftm = 1 and fta = 2 from public.player_game_stats where game_id = 't-game' and athlete_id = 'kyan-cheng'
), 'free throws made/attempted');

-- Media ----------------------------------------------------------------------

select pg_temp.act_as('anon');
select pg_temp.expect_error(
  $$insert into public.media (kind, url) values ('photo', 'https://example.com/x.jpg')$$,
  'anon cannot add media');
select pg_temp.expect_error(
  $$insert into storage.objects (bucket_id, name) values ('media', 'x.jpg')$$,
  'anon cannot upload to the media bucket');
reset role;

select pg_temp.act_as('operator');
select pg_temp.expect_error(
  $$insert into public.media (kind, url) values ('photo', 'https://example.com/x.jpg')$$,
  'stat operators cannot add media');
reset role;

select pg_temp.act_as('admin');
insert into storage.objects (bucket_id, name) values ('media', 'photos/test.jpg');
insert into public.media (kind, title, url, storage_paths) values ('photo', 'Test', 'https://example.com/photos/test.jpg', '{photos/test.jpg}');
select pg_temp.check((select count(*) = 1 from public.media where title = 'Test'), 'admins can upload and add media');
reset role;

select pg_temp.act_as('anon');
select pg_temp.check((select count(*) >= 1 from public.media), 'anyone can view media');
reset role;

\echo 'All database tests passed.'
rollback;
