# Setup

How to go from this repo to a live site. Steps 1–4 happen once.

## 0. Run it locally without a database (demo mode)

```bash
npm install
npm run dev:demo
```

Open http://localhost:3000. Everything runs on sample data. The operator console at `/operator` saves to your browser only, so an operator tab and a viewer tab on the same computer update each other. Use this for practice and demos.

## 1. Create the Supabase project

Create a project at supabase.com. Ideally it's owned by a school account, with you added as a Developer (see PILOT_PLAN.md → Supabase).

Then, in **SQL Editor**, run these files in order:

1. `supabase/migrations/20260929000000_pilot_schema.sql` (tables, rules, realtime)
2. `supabase/seed.sql` (season, the 4 teams, current rosters)
3. *(Optional, for testing only)* `supabase/demo-seed.sql` (sample games). Remove it before the season:
   ```sql
   delete from public.games where id like 'demo-%';
   delete from public.opponents where id like 'demo-%';
   ```

## 2. Lock down sign-ups and create staff accounts

- **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up". Only people you add can sign in.
- **Authentication → Users → Add user**: create each staff account with an email and password, and tick "Auto confirm".
- Give each account a role in **SQL Editor**:

```sql
-- Admin: can edit games, rosters, opponents and news, and run games.
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'athletics@example.com';

-- Stat operator: can run games only.
insert into public.user_roles (user_id, role)
select id, 'stat_operator' from auth.users where email = 'manager@example.com';
```

## 3. Connect the site

Copy **Project Settings → API**'s URL and publishable key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Then check it:

```bash
npm run check:supabase
npm run dev
```

## 4. Deploy (Vercel)

Import the repo in Vercel (the project is at the repo root, so leave Root Directory as-is). Add the same two environment variables and deploy. Don't set `NEXT_PUBLIC_SSN_DEMO` in production.

## Supabase GitHub integration

Migrations in `supabase/migrations/` use the Supabase CLI's naming (`YYYYMMDDHHMMSS_name.sql`). If the integration is set to deploy migrations on push, a migration that was already applied by hand must be recorded first, or it will be re-run and fail:

```sql
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name)
values ('20260929000000', 'pilot_schema') on conflict do nothing;
```

## Google Calendar (schedule page)

The Schedule page shows the athletics Google Calendar as cards. Edits made in Google Calendar (including on a phone) appear on the site within about 5 minutes.

1. In Google Calendar on a computer, open the calendar's **Settings and sharing**.
2. Under **Access permissions for events**, tick **Make available to public** and choose **See all event details**.
3. Under **Integrate calendar**, copy the **Calendar ID** (it looks like `abc123@group.calendar.google.com`).
4. In Vercel, go to **Settings → Environment Variables** and add `GOOGLE_CALENDAR_ID` with that value (Production and Preview). Then redeploy.

Tips for whoever edits the calendar:
- Put the opponent's name in game titles (e.g. "Varsity Boys vs TAS"). When it matches a game in Admin on the same day, the card links to live scores and the box score.
- Games still need to be added in **Admin → Games** to be scored live. The calendar is for everyone's schedule (games, practices, buses); Admin is for the games the operator will track.

Until the variable is set, the Schedule page lists the games from Admin instead.

## Updating rosters

Either use **Admin → Rosters** on the site, or edit `data/seed/roster.json`, run `npm run seed:generate`, and re-run `supabase/seed.sql` (it updates in place).

## Tests

```bash
npm test          # stat math + court geometry (also cross-checks the SQL views if the local DB exists)
npm run test:db   # builds a throwaway local Postgres DB and tests the schema, permissions and clock
```

`test:db` needs a local Postgres (`brew install postgresql@16`). It uses a database named `ssn_pilot_test` and never touches Supabase.
