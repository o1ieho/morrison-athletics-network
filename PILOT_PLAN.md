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

### Phase 0: Foundation (unblocks everything)
- [ ] **Oliver:** check whether the old Supabase project can be restored, or create a new one. Send the URL and publishable key.
- [ ] Fix the TypeScript build errors so `npm run build` passes.
- [ ] Write one clean pilot migration (see *Data model* below).
- [ ] Seed the 2026-27 season, the 4 MAT basketball teams (Varsity and JV, Boys and Girls), opponents, the current roster and the schedule.
- [ ] Remove the silent demo-data fallbacks; show real empty and error states instead. Keep demo data only behind an explicit `DEMO_MODE` flag for local dev.
- [ ] Format all dates and times in `Asia/Taipei`.
- [ ] Put the Supabase keys only in env vars (remove the hard-coded key from `scripts/test-connection.mjs`).

### Phase 1: Login and access
- [ ] `/login` page (Supabase email and password).
- [ ] Protect `/admin/*` and `/operator/*` on the server; redirect to login.
- [ ] Hide operator and admin links from public visitors.
- [ ] Access rules: writes require an `admin` or `stat_operator` row in `user_roles`.
- [ ] **Oliver:** turn off public sign-ups in Supabase Auth and create the operator accounts.

### Phase 2: Operator console (rebuild)
- [ ] Correct event types: 2PT/3PT/FT made **and** missed, off/def rebound, assist, steal, block, turnover, foul, timeout, period start/end.
- [ ] A clear entry flow (action → player → shot spot for field goals), with the pending step shown on screen and a cancel button.
- [ ] Every tap saves immediately. The score is **derived from plays** in the database, never typed in.
- [ ] Show a "saved / sending / failed" state on each play; queue and retry when gym Wi-Fi drops.
- [ ] Clock stored as `running + started_at + seconds_left`, so viewers see it tick without a database write every second.
- [ ] Start/end quarter and set status (Scheduled → Live → Final), with a confirmation before Final.
- [ ] Undo that still works after a refresh; tap any play in the log to edit or delete it.
- [ ] Team fouls, bonus indicator and timeouts left, all derived from plays. Foul reset period and bonus threshold are per-game settings (rule TBD, see Open questions).
- [ ] Opponent tracked as team totals only: score, team fouls, timeouts. No opponent player picker.
- [ ] Pre-game setup: active roster and quarter length (default 8 minutes).
- [ ] Laptop- and tablet-first layout, large touch targets, keyboard shortcuts, connection indicator.
- [ ] Store shot spots as 0–1, keeping 0.

### Phase 3: Public live game page
- [ ] Scoreboard header: score, live clock, quarter, team fouls, status. Updates in place (no full page reload).
- [ ] Play-by-play feed, newest first, with a quarter filter.
- [ ] Box score built from plays for the MAT team: PTS, FGM-A, 3PM-A, FTM-A, REB, AST, STL, BLK, TOV, PF, plus team totals. Opponent shows team totals only.
- [ ] Shot chart with a per-player filter.
- [ ] Game leaders computed automatically.
- [ ] Final-game recap state.
- [ ] Re-sync when a phone wakes up or reconnects.

### Phase 4: Season stats
- [ ] Database view: player season totals and averages (GP, PPG, RPG, APG, FG%, 3P%, FT%).
- [ ] Player game log on the athlete page.
- [ ] Team record computed from final games.
- [ ] Stat leaders page.

### Phase 5: UI/UX pass
- [ ] Mobile header: compact bar plus menu (or bottom tabs); fix desktop nav overflow.
- [ ] Homepage: live or next game first, a smaller hero, latest results, then announcements. Hide empty sections.
- [ ] Trim the nav to basketball-pilot pages; hide Media and other sports until they're real.
- [ ] Rewrite dev-speak copy.
- [ ] Loading skeletons, empty states, 404 page.
- [ ] One shared `Court` / `ShotChart` component; move inline styles into CSS.
- [ ] Accessibility: contrast, focus rings, tables readable on phones.

### Phase 6: Admin for the pilot
- [ ] Games: create **and edit**; quick-add opponent; Taipei time input.
- [ ] Roster: create and edit; unique jersey number per team; unique slugs.
- [ ] Show errors in the UI, not the console.
- [ ] Hide placeholder admin pages (coaches, media, standings) for now.

### Phase 7: Test and launch
- [ ] Unit tests for the stat math (box score and season averages from plays).
- [ ] A script that simulates a full game's events against the database.
- [ ] Two-device test: laptop operator plus phone viewer, including a Wi-Fi drop mid-game.
- [ ] Deploy to Vercel with env vars.
- [ ] A one-page operator runbook, plus a paper-scoresheet fallback.
- [ ] Dry run at a scrimmage before a real game.

### Cleanup (later)
- [ ] Archive the old static site (`index.html`, `ops-*.html`, `backend/`) once the pilot works.
- [ ] Add `.freebuff/` to `.gitignore`.

---

## Data model changes (pilot migration)

- `ssn_event_type`: add `fg2_miss`, `fg3_miss`, `ft_miss`, `rebound_off`, `rebound_def`, `timeout`, `period_start`, `period_end`; rename the made types to `fg2_made` / `fg3_made` / `ft_made`.
- `games`: add `period_length_seconds`, `clock_running`, `clock_seconds_left`, `clock_started_at`; make `home_score` / `away_score` maintained by a trigger from non-voided events.
- Views: `game_box_scores` (per player per game) and `player_season_stats`.
- Access rules: public read; writes need `has_role('admin' | 'stat_operator')`.

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
