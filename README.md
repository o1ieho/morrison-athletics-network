# SSN Platform Rebuild

Fresh Next.js implementation of the Morrison Academy Taipei Athletics SSN platform.

## What this contains

- Next.js App Router shell
- Morrison Academy Taipei Athletics public routes
- Protected admin/operator route structure
- Legacy SSN seed data copied into `data/legacy`
- Relational Supabase migration in `supabase/migrations`
- Seed SQL generator for importing current SSN content into the relational model

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Generate relational seed SQL

```bash
npm run seed:legacy
```

The output is written to `supabase/seed-rebuild.sql`.
