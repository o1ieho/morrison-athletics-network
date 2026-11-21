-- Stat operators could change any game at any time: a past final, a game
-- next month, another team's game. Now a stat operator can only change a game
-- on its game day, from 12 hours before tip-off until 12 hours after (enough
-- for a late start, overtime and same-night corrections). Admins are not
-- limited. lib/operator-window.ts mirrors the window for the operator screens.
--
-- Safe to run more than once.

create or replace function public.can_operate_game(p_game_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or (
    public.has_role(array['stat_operator']::public.ssn_role[])
    and exists (
      select 1 from public.games g
      where g.id = p_game_id
        and now() between g.starts_at - interval '12 hours' and g.starts_at + interval '12 hours'
    )
  );
$$;

create or replace function public.assert_can_operate_game(p_game_id text)
returns void
language plpgsql
stable
as $$
begin
  if not public.can_operate_game(p_game_id) then
    raise exception 'Stat operators can only change a game on its game day' using errcode = '42501';
  end if;
end;
$$;

-- Direct writes (plays, undo) follow the same rule.
drop policy if exists "operator update games" on public.games;
create policy "operator update games" on public.games for update
  using (public.can_operate_game(id)) with check (public.can_operate_game(id));

drop policy if exists "operator insert events" on public.game_events;
create policy "operator insert events" on public.game_events for insert
  with check (public.can_operate_game(game_id));

drop policy if exists "operator update events" on public.game_events;
create policy "operator update events" on public.game_events for update
  using (public.can_operate_game(game_id)) with check (public.can_operate_game(game_id));

-- The clock and period controls check the game too.

create or replace function public.clock_start(p_game_id text)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate_game(p_game_id);
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

create or replace function public.clock_stop(p_game_id text)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate_game(p_game_id);
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

create or replace function public.clock_set(p_game_id text, p_seconds_left integer)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate_game(p_game_id);
  update public.games
  set
    clock_seconds_left = greatest(0, p_seconds_left),
    clock_anchor_at = case when clock_running then now() else null end
  where id = p_game_id
  returning * into g;
  return g;
end;
$$;

create or replace function public.start_period(p_game_id text, p_period integer)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate_game(p_game_id);
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

create or replace function public.end_period(p_game_id text)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate_game(p_game_id);
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

create or replace function public.set_game_status(p_game_id text, p_status public.ssn_game_status)
returns public.games
language plpgsql
as $$
declare
  g public.games;
begin
  perform public.assert_can_operate_game(p_game_id);
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
