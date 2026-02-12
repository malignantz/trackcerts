# TrackCerts

TrackCerts is a SvelteKit application for managing medical staff certification verification workflows.

## Phase 1 delivered

- SvelteKit + TypeScript + Tailwind baseline using `@sveltejs/adapter-node`
- Supabase magic-link auth scaffold for manager sign-in
- Multi-organization core schema with org-scoped membership checks
- Organization onboarding for first authenticated user
- Staff CRUD (`/app/staff`, `/app/staff/new`, `/app/staff/:id/edit`)
- Configurable per-organization certification types (`/app/settings/certifications`)
- Async pipeline stub interfaces and internal dispatch endpoint
- Drizzle schema + SQL migration generation support
- Unit/integration/e2e smoke tests

## Architecture overview

### App-wide flow

1. Manager signs in with Supabase magic link.
2. If no organization exists, first authenticated manager can create one.
3. Organization members manage staff and certification type records.
4. Future verification phases enqueue jobs and process documents asynchronously.

### Core modules

- `src/lib/server/db`: Drizzle schema and DB client
- `src/lib/server/auth`: access policy + membership resolution
- `src/lib/server/org`: onboarding + certification type services
- `src/lib/server/staff`: org-scoped staff repository
- `src/lib/server/services`: no-op interfaces for future async processing
- `src/lib/validation`: Zod schemas for all form actions

## Environment variables

Copy `.env.example` to `.env` and fill:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `APP_URL` (for auth callback URL)

### Supabase Auth settings required for magic links

In Supabase Dashboard -> Authentication -> URL Configuration:

- Set **Site URL** to your app origin (for local dev: `http://localhost:5173`)
- Add **Redirect URL**: `http://localhost:5173/auth/callback`

Without this, magic links can fail or redirect incorrectly.

## Local development

```bash
npm install
docker compose up -d
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

If you already run Postgres elsewhere, skip `docker compose up -d` and set `DATABASE_URL` in `.env`.

### Demo seed data

Run the seed script any time to ensure demo data exists (idempotent):

```bash
npm run db:seed
```

Optional environment overrides:

- `SEED_ORGANIZATION_NAME`
- `SEED_ORGANIZATION_SLUG`
- `SEED_OWNER_USER_ID` (binds org owner membership to a specific Supabase user id)
- `SEED_OWNER_EMAIL`

## Quality checks

```bash
npm run check
npm run lint
npm run format
npm run test
npm run test:e2e
```

## Migration workflow

- Schema source of truth: `src/lib/server/db/schema.ts`
- Generate SQL migrations:

```bash
npm run db:generate
```

- Apply directly to DB (optional during local dev):

```bash
npm run db:push
```

## Key routes

- `/login`
- `/app/onboarding`
- `/app/staff`
- `/app/staff/new`
- `/app/staff/:id/edit`
- `/app/settings/certifications`
- `POST /api/internal/submissions/:id/dispatch`
