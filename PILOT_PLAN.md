# Basketball Pilot Plan

Goal: one operator on a laptop or tablet enters stats during a game, and every phone watching sees the score, clock, play-by-play, box score and shot chart update live. Stats are saved and roll up into player season numbers.

Scope: basketball only. Other sports stay out of the nav until they have real data.

Branch: `pilot/basketball` (baseline commit `e57e219` is the rebuild as it was).

---

## Code review findings

Things that are broken today, in rough order of severity.

| # | Problem | Where |
|---|---------|-------|
| 1 | Supabase project no longer resolves (NXDOMAIN). Every query fails. | `.env.local` |
| 2 | Every query silently falls back to hard-coded demo data on error, so the site looks fine while nothing is real. | `lib/supabase-queries.ts` |
| 3 | `npm run build` fails on a type error, so the site can't be deployed. | `app/live/[gameId]/*.tsx` |
| 4 | No login anywhere. The database only accepts writes from signed-in users, so every operator action would fail. | whole app |
| 5 | `/admin` and `/operator` are unprotected and linked in the public header. | `app/layout.tsx` |
| 6 | The access rules are too loose: any signed-in account can edit everything, and `user_roles` is never checked. | migration `…0001_rebuild_relational_core.sql` |
| 7 | Misses are saved as `field_goal_made`; Timeout, Other, quarter start/end and score corrections are saved as `assist`. | operator page |
| 8 | The score is a number the operator's browser overwrites, not derived from plays, so it drifts on refresh, undo or a second device. | operator page |
| 9 | Clock, quarter, status, fouls and timeouts only save on "Save Score"; viewers never see the clock. | operator page |
| 10 | Shot chart: positions saved as 0–100 and multiplied by 100 again on display, so markers render off the court; `x \|\| null` drops 0. | operator + live pages |
| 11 | The box score ignores game plays and shows 8 players' hard-coded season averages. | `box-score/page.tsx` |
| 12 | Player season stats are hard-coded; team record is always `0-0`; game leaders are a placeholder string. | `supabase-queries.ts` |
| 13 | The operator page hangs on "Loading…" forever when a request throws (no error state). | operator page |
| 14 | Times are formatted in the server's timezone (UTC on Vercel), not Taipei. | `lib/utils.ts` |
| 15 | Admin: no way to edit an existing record, errors only go to `console`, team IDs come from the first 3 letters of the slug (collisions), and the season is hard-coded. | `app/admin/*` |
| 16 | Home actions with no player selected are labelled "Taipei Academy Tigers". | operator page |

## UI/UX review

- On phones the header is ~150px tall with a sideways-scrolling nav that cuts off items, and the hero fills the whole first screen, so no score is visible without scrolling.
- At 1280px the desktop nav is already clipped ("ABOUT ATHLETICS" cut off).
- The homepage leads with branding, not the live or next game. "Upcoming" can render empty.
- `/live` labels a non-live game "Currently live" when nothing is live.
- Copy reads like dev notes: "Persistent athlete profiles", "Composite", "SSN is being rebuilt", "Game leaders will appear here", "Structured workflow placeholder".
- The athlete page shows `· undefined` for missing height/weight and lists every media item as "related".
- The box score table is cramped on mobile and shows raw team IDs (`MAT-BBB-V`).
- The court SVG and marker code are copy-pasted in three places with inline styles.

---

## Checklist

Status as of 2026-09-29. Everything that doesn't need a live Supabase project is built and tested in demo mode and against a local Postgres.

### Phase 0: Foundation
- [ ] **Oliver:** get a Supabase project (restore, school-owned, or new) and send the URL and publishable key.
- [x] Fix the build: `npm run build` passes. Also upgraded Next.js to 16.3.6 for security fixes.
- [x] One clean pilot migration (`supabase/migrations/202609290001_pilot_schema.sql`), tested by `npm run test:db` (28 checks).
- [x] Seed: 2026-27 season, the 4 teams and current rosters (`supabase/seed.sql`, generated from `data/seed/roster.json`). Opponents and schedule come in via Admin once known.
- [x] Silent fallbacks removed. Errors show an error page; demo data only appears in demo mode, with a banner.
- [x] All dates and times in `Asia/Taipei`.
- [x] Keys only in env vars (`scripts/check-supabase.mjs` replaces the hard-coded test script).

### Phase 1: Login and access
- [x] `/login` (Supabase email and password).
- [x] `/admin/*` and `/operator/*` check roles on the server (`lib/auth.ts`); `proxy.ts` refreshes sessions.
- [x] Operator and admin links removed from the public header (a "Staff sign-in" link sits in the footer).
- [x] Database rules: writes need an `admin` or `stat_operator` role.
- [ ] **Oliver:** turn off public sign-ups and create staff accounts (SETUP.md step 2).
- [ ] Test the real sign-in flow once Supabase exists.

### Phase 2: Operator console
- [x] Full event types, makes **and** misses.
- [x] Entry either way (player → stat or stat → player), with the pending step on screen and a Clear button.
- [x] Court tap auto-detects 2 vs 3 (FIBA court); assist and offensive-rebound follow-ups.
- [x] Every tap saves; scores are derived from plays by a database trigger.
- [x] Offline-safe queue: saved to the device, retried with backoff, no duplicates on retry, warns before closing.
- [x] Server-time clock; viewers tick it locally.
- [x] Start/end quarter, overtime, finish game (with confirmation), reopen.
- [x] Undo/restore any play, including after a refresh (Ctrl+Z works).
- [x] Team fouls, bonus and timeouts derived from plays; foul reset and bonus threshold are per-game settings.
- [x] Opponent as team totals only.
- [x] Quarter length per game (Admin → game → Rules, default 8 minutes).
- [ ] Pre-game "active players" selection (hide players who aren't dressed). *Nice to have.*
- [x] Fits one screen on a landscape tablet or laptop; keyboard shortcuts; connection and "All saved" indicators.
- [ ] Real-network test: operator laptop plus phone viewer on Supabase, including a Wi-Fi drop. **Needs Supabase.**

### Phase 3: Public live game page
- [x] Scoreboard with live clock, quarter, team fouls and bonus; updates in place.
- [x] Play-by-play grouped by quarter with running score. (A quarter filter wasn't needed.)
- [x] Box score from plays, with team totals and shooting percentages; opponent totals.
- [x] Shot chart with a per-player filter.
- [x] Game leaders.
- [x] Final and upcoming states (the pre-game view shows the roster).
- [x] Re-syncs after reconnecting or when a phone wakes.

### Phase 4: Season stats
- [x] Database views: `player_game_stats`, `player_season_stats`, `team_records`.
- [x] Player page with season averages and game log.
- [x] Team records from final games.
- [x] Sortable stats page per team.

### Phase 5: UI/UX pass
- [x] New design system (Broncos green, condensed display type); mobile menu; no clipped nav.
- [x] Home: score strip, live or next game first, upcoming, results, team records, scoring leaders.
- [x] Nav trimmed to Home, Schedule, Teams, Stats, News. Other sports and media are hidden.
- [x] Copy rewritten.
- [x] Empty states, a 404 page, an error page. *(Loading skeletons: not yet.)*
- [x] One shared FIBA `Court` component; the old copy-pasted inline SVGs are gone.
- [x] Tables scroll sideways on phones with a sticky player column; focus rings; labelled controls.

### Phase 6: Admin for the pilot
- [x] Games: create, edit, delete (with confirmation), Taipei time, manual-score mode for untracked games, per-game rules.
- [x] Rosters: add, edit, remove; duplicate jerseys are caught; unique slugs.
- [x] Opponents: add and edit. *(Not quick-add from the game form yet.)*
- [x] News: create, edit, publish/draft, pin, delete.
- [x] Errors shown in the UI. Placeholder admin pages removed.

### Phase 7: Test and launch
- [x] Unit tests for stat math and court geometry (`npm test`, 12 checks), cross-checked against the SQL views.
- [x] Game simulator (`scripts/lib/simulate-game.mjs`) used for the demo data.
- [ ] A script that replays a simulated game live against Supabase (load test). **Needs Supabase.**
- [ ] Deploy to Vercel (SETUP.md step 4). **Needs Supabase.**
- [x] Operator runbook: OPERATOR_GUIDE.md.
- [ ] Dry run at a scrimmage.

### Cleanup (later)
- [ ] Archive the old static site (`index.html`, `ops-*.html`, `backend/`) once the pilot works.
- [ ] Add `.freebuff/` to the root `.gitignore`.

---

## Data model (pilot migration)

- Every game is **one MAT team vs one opponent** (`games.team_id`, `opponent_id`, `is_home`). Opponents live in their own table, as team totals only.
- `game_events.side` is `team`, `opponent` or `game` (period markers). The event types cover makes **and** misses; `points` is computed from the type.
- Scores are maintained by a trigger from non-voided events, unless a game uses `scoring_mode = 'manual'` (for games nobody tracked live).
- Clock: `clock_running`, `clock_seconds_left`, `clock_anchor_at`, changed only through server-time RPCs (`clock_start`, `clock_stop`, `clock_set`, `start_period`, `end_period`, `set_game_status`).
- Per-game rules: `period_length_seconds` (default 480), `overtime_length_seconds`, `foul_reset`, `bonus_threshold`.
- Views: `player_game_stats`, `player_season_stats` (final games only), `team_records`.
- Access rules: anyone can read; `stat_operator` can run games; `admin` can edit everything. Undo is a soft delete (`voided_at`), so viewers receive it in realtime.

## Decisions (2026-09-29)

- **Teams:** 4 MAT teams: Varsity Boys, Varsity Girls, JV Boys, JV Girls.
- **Quarters:** 8 minutes (believed; confirm with the athletic director). Keep it as a per-game setting, not hard-coded.
- **Opponents:** team totals only. No opponent players, no opponent box score.
- **Operator:** one person (usually a team manager) runs each game alone, so speed and minimal taps matter more than stat depth.
- **Roster:** use the current players for now. Oliver will send the real 2026-27 rosters when the season starts. Girls and JV rosters stay empty until then.
- **Database host:** undecided. See *Supabase* below.

## Open questions

1. **Team fouls:** do they reset per quarter or per half, and what's the bonus threshold under TISSA rules? *Parked for later.* Build this as a per-game setting (default: per quarter, bonus at 5) so it's a config change, not a code change.
2. Confirm the 8-minute quarters and the overtime length.

## Supabase

The old project is paused, and a free account can only have 2 active projects (counted across every organization where you're an Owner or Admin). Oliver already uses both slots. Free projects also pause after 1 week with no activity.

Options, best first:
1. **A school-owned Supabase organization.** Someone at MAT (athletic director or a staff sponsor) owns it, and Oliver is added as a Developer. It uses their free slot, not Oliver's, and it solves "who owns this after Oliver graduates." It can move to Pro later if the school wants.
2. **Pause one of Oliver's other two projects**, if one is idle, and restore this one. No cost, but it stays tied to Oliver's personal account.
3. **Pro plan** (from $25/month): no pausing, no project limit. Worth it once the school commits beyond the pilot.
4. **Switch platforms** (Firebase, Convex, etc.). Not recommended: the auth, access rules, realtime and data code are all built on Supabase, so it means a rewrite for no pilot benefit.

Notes:
- The new pilot migration rebuilds the schema from scratch, and the seed data comes from `data/legacy/`, so we don't need anything from the old project unless data was entered there by hand.
- Auto-pause: during the season, real traffic keeps the project active. Off-season it may pause; restore it before the next season starts.
