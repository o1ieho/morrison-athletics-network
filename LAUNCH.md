# Launch kit (basketball, 2026-27)

Written Nov 15, 2026. The code is done (see PILOT_PLAN.md). What's left is setup, people and one test. Do the steps in order. Avoid launching during finals (Dec 7 to 18): launch before Dec 7 or at the first game after winter break.

## Where things stand (checked Nov 15)

| Item | Status |
|---|---|
| Live site | Up at morrison-athletics-network.vercel.app, connected to the real Supabase database, login working |
| Database contents | Still the September **sample season**: 14 games (one stuck on "LIVE" since Sep 29), 1,110 simulated plays, 6 fake opponents, 3 fake news posts. Visitors see it as real (no banner, because the site isn't in demo mode). |
| Boys varsity roster | 12 players, ready |
| Girls varsity roster | Only 3 players |
| JV rosters | Empty |
| Schedule page | Google Calendar not connected, so it lists games from Admin (currently the fake ones) |
| Phone layout | Fine (tested at 375 px, no sideways scrolling) |
| Staff accounts | Not set up yet |

## Step 0: Ship the game-day fixes (10 min)

On Nov 15 a code review found bugs that could lose plays or show a wrong score on bad Wi-Fi. They are fixed on the `add-analytics` branch (with the visitor analytics). Do these two things, in this order:

1. **Merge `add-analytics` into `main`** so Vercel deploys it. Wait for the deploy to finish.
2. **Then** run the clock fix in Supabase → SQL Editor: paste the contents of `supabase/migrations/20261115000000_clock_rounding.sql` and run it. (It replaces one small function. Before this, the clock fell about 10 seconds behind per quarter.)

What changed, in plain words: plays can no longer vanish when a clock button is pressed mid-save; a removed play can't come back; a stuck request times out after 10 seconds instead of freezing saving; overtime fouls count toward the bonus; the operator's score is added up from the plays; a signed-out operator gets a "Sign in again" bar; an offline bar tells the operator not to refresh; the iPad screen stays on; buttons are finger-sized; the game list shows unsent plays.

Still not done (accepted risks): the console can't be opened without Wi-Fi (so open it before tip-off and don't refresh), and nobody has tested 50+ phones following at once.

## Step 0b: Two more database changes (Nov 21, 5 min)

In Supabase → SQL Editor, paste and run each file's contents, in this order. Both are safe to run more than once.

1. `supabase/migrations/20261121000000_operator_game_day.sql`: stat operators can only change a game on its game day (12 hours before tip-off to 12 hours after). Admins can still change anything. Until this runs, any stat operator can edit any game.
2. `supabase/migrations/20261121000100_league_standings.sql`: adds the league standings table behind **Admin → Standings**. Until this runs, team pages simply show no standings.

## Step 1: Clear the sample season (5 min, do first)

There's no "clear all" button in Admin. In the Supabase dashboard, open **SQL Editor** and run:

```sql
-- Deletes the sample games (their plays go with them), sample opponents and sample news.
delete from public.games where id like 'demo-%';
delete from public.opponents where id like 'demo-%';
delete from public.announcements
 where title in ('Senior Night this Friday: Broncos host the Tigers',
                 'Bus time change for Saturday''s away games',
                 'Broncos fall 51–52 to Knights in a one-point thriller');
```

Then open the live site: no "LIVE" game, no results, no news. Records reset to 0-0 on their own (they come from final games).

## Step 2: Talk to Coach (one conversation)

Message to send (edit freely):

> Hi Coach, I've finished building a live stats site for our basketball teams: live score and clock, play-by-play, box scores, shot charts and season stats that anyone can follow on their phone. One of the managers would enter stats on a laptop during games. Could we try it at a home game? I'd need three things from you: OK to use the Broncos name and logo and share the link with the team and parents, the game schedule, and which manager(s) would be up for running stats. Happy to show you a demo first. It takes 2 minutes.

Get from him:
- [ ] OK to use the name and logo and share the link
- [ ] The schedule (dates, opponents, home or away, tip-off times)
- [ ] Manager name(s) and email(s) for stat operator accounts
- [ ] Girls varsity and JV rosters (names, numbers, positions), if those teams are included

## Step 3: Set up accounts (15 min, Supabase dashboard)

Full detail in SETUP.md step 2.
1. **Authentication → Sign In / Providers → Email:** turn off "Allow new users to sign up".
2. **Authentication → Users → Add user:** one account for you, one per manager. Tick "Auto confirm". You choose the passwords and give them to the managers yourself.
3. **SQL Editor:** give each account its role (replace the emails):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR-EMAIL';

insert into public.user_roles (user_id, role)
select id, 'stat_operator' from auth.users where email = 'MANAGER-EMAIL';
```

4. Sign in at /login (footer: "Staff sign-in") and check you reach /admin.

## Step 4: Enter the real season (30 to 45 min, in Admin)

- [ ] **Opponents:** Admin → Opponents, add each school.
- [ ] **Rosters:** Admin → Roster. Boys varsity is in; add girls varsity and JV if those teams are included.
- [ ] **Games:** Admin → Games, add each game with Taipei tip-off time. For games nobody will track live, use manual-score mode and type the final score afterwards.
- [ ] **Optional, schedule from Google Calendar:** if the athletics office keeps a public Google Calendar, follow SETUP.md "Google Calendar" (it needs the Calendar ID added in Vercel, then a redeploy). Otherwise the Schedule page lists the Admin games, which is fine.

## Step 5: Dry run (one practice or scrimmage)

- The manager signs in on a laptop or tablet and logs a scrimmage from start to finish. OPERATOR_GUIDE.md is the cheat sheet; print it.
- You watch on a phone at the same time and check the score, clock and box score update.
- Turn the laptop's Wi-Fi off for a minute mid-game, then back on. Plays should queue and then save, with nothing doubled.
- Afterwards, delete the scrimmage game in Admin (or keep it as a test).

## Step 6: Launch at a home game

Post for the team chat and parents (edit freely; add a Chinese version if parents need one):

> Follow Broncos basketball live: morrison-athletics-network.vercel.app
> Live score and clock, play-by-play, box scores and season stats, updated from the sideline by our team managers. First live game: [DATE] vs [OPPONENT].

Start with boys varsity only. Add other teams only if the managers can cover them.

## Step 7: Track it through February

Write these down after each game (they decide whether this stays its own activity, gets folded into the basketball entry, or gets dropped):

| Game | Logged live? | Plays logged | People who followed (Vercel Analytics, if turned on) | Problems |
|---|---|---|---|---|
| | | | | |

To count visitors: the code is in (branch `add-analytics`, `<Analytics />` in `app/layout.tsx`). Before launch: merge it to `main` so Vercel deploys it, then turn on **Vercel → Project → Analytics → Enable** (free tier). Page views per day then show in that tab; compare game days against normal days.
