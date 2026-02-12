# App Architecture

## Purpose

TrackCerts manages certification workflows for medical organizations with strict tenant boundaries.

## Runtime components

1. SvelteKit web app

- Authenticated manager UI for onboarding, staff, and certification settings.
- API route stubs for internal async dispatch.

2. Auth layer (Supabase)

- Magic-link login initiation on `/login`.
- Client-side auth confirmation for email hash-token links on `/auth/confirm`.
- Server callback verification for token-hash and code flows on `/auth/callback`.
- Session exchange endpoint on `/auth/session`.
- Session hydration and user resolution in `src/hooks.server.ts`.

3. Data layer (Postgres + Drizzle)

- Multi-org schema with memberships and org-scoped resources.
- Async pipeline tables for future worker phases.

## Route and tenancy model

- `/(auth)` routes are public (`/login`, auth callbacks).
- `/(app)` routes are protected in `src/routes/(app)/+layout.server.ts`.
- Tenant context is always derived from active membership server-side.
- Client payloads never supply trusted `organization_id`; all writes use membership-derived org context.

## Request lifecycle

1. Incoming request initializes Supabase server client in hooks.
2. Hooks resolve authenticated user session and pre-load active membership into `locals.membership`.
3. Protected app layout verifies user session and applies route-level access policy.
4. Authenticated users without membership are redirected to onboarding guidance.
5. Onboarding creation is allowed only while organization bootstrap is open (first-org creation).
6. Route actions run Zod validation and execute org-scoped DB writes.

## Security baseline

- Org IDs are never trusted from client payloads.
- Membership-derived org context controls all app writes.
- Access-denied events are captured in `audit_logs` (for example, blocked bootstrap attempts).
