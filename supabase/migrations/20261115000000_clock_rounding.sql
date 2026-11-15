-- The game clock ran slow: every time it was stopped, the part of a second
-- that had passed was thrown away (rounded down), about half a second per
-- stop, so the clock fell roughly 10 seconds behind real time over a quarter.
--
-- Round to the nearest second instead. Each stop is now off by at most half a
-- second in either direction, and the errors cancel out instead of adding up.
-- lib/basketball.ts (clockSecondsLeft) rounds the same way, so viewers see
-- exactly the value the server keeps when the clock stops.
create or replace function public.game_clock_now(g public.games)
returns integer
language sql
stable
as $$
  select case
    when g.clock_running and g.clock_anchor_at is not null then
      greatest(0, g.clock_seconds_left - round(extract(epoch from (now() - g.clock_anchor_at)))::integer)
    else g.clock_seconds_left
  end;
$$;
