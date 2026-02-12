# App Architecture

## Purpose

TrackCerts manages certification workflows for medical organizations with strict tenant boundaries.

## Runtime components

1. SvelteKit web app

- Authenticated manager UI for onboarding, staff, and certification settings.
- API route stubs for internal async dispatch.

2. Auth layer (Supabase)

- Magic-link login.
- Session hydration in `src/hooks.server.ts`.

3. Data layer (Postgres + Drizzle)

- Multi-org schema with memberships and org-scoped resources.
- Async pipeline tables for future worker phases.

## Request lifecycle

1. Incoming request initializes Supabase server client in hooks.
2. Protected app layout verifies user session.
3. Membership resolution gates access and sets org context.
4. Route actions run Zod validation and execute org-scoped DB writes.

## Security baseline

- Org IDs are never trusted from client payloads.
- Membership-derived org context controls all app writes.
- Access-denied events are captured in `audit_logs`.
