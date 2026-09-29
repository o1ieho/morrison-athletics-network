# MAT Athletics (SSN platform)

Live scores, box scores, schedules and season stats for Morrison Academy Taipei Broncos basketball. A student stat operator logs plays from the sideline, and every phone following the game updates in real time.

- **Public site:** home, schedule (from the athletics Google Calendar), teams with sortable season stats, player pages, and game pages (live scoreboard, play-by-play, box score, shot chart).
- **Operator console** (`/operator`): fast play entry for one person, offline-safe.
- **Media** (`/media`): photos and YouTube highlights, uploaded by admins.
- **Admin** (`/admin`): games, rosters, opponents, news, media.

Stack: Next.js 16 (App Router), Supabase (Postgres, auth, realtime), TypeScript.

## Quick start

```bash
npm install
npm run dev:demo      # runs on sample data, no database needed
```

- [SETUP.md](SETUP.md): connecting Supabase, staff accounts, deploying
- [OPERATOR_GUIDE.md](OPERATOR_GUIDE.md): the game-day cheat sheet
- [PILOT_PLAN.md](PILOT_PLAN.md): pilot scope, decisions and checklist

## How it fits together

| Where | What |
|---|---|
| `supabase/migrations/` | The schema. Scores are derived from `game_events` by a trigger; clock and period changes are server-time RPCs; access is role-based (`admin`, `stat_operator`). |
| `lib/basketball.ts` | Stat math and play-by-play text shared by every screen (mirrors the SQL views; tests check they agree). |
| `lib/data/` | Server-side reads for public pages (Supabase or demo). |
| `lib/live/` | Realtime game state and operator writes (Supabase or in-browser demo), plus the offline play queue. |
| `components/operator/console.tsx` | The operator console. |
| `components/game-center.tsx` | The public live game page. |
| `data/seed/roster.json` | The roster source. `npm run seed:generate` turns it into SQL. |
