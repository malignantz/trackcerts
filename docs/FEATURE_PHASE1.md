# Phase 1 Feature Map

## Implemented feature set

1. Manager authentication (`/login`)

- Email magic-link initiation.
- Client confirmation route for magic-link hash tokens (`/auth/confirm`).
- Server callback verification for token-hash links (`/auth/callback`).

2. First-user organization bootstrap (`/app/onboarding`)

- Allowed only when no organization exists.
- Creates organization + owner membership transactionally.

3. Staff roster CRUD

- List/search: `/app/staff`
- Create: `/app/staff/new`
- Edit/deactivate: `/app/staff/:id/edit`

4. Certification type management

- `/app/settings/certifications`
- Create/update/activate/deactivate org-specific cert definitions.

5. Async processing stubs

- `VerificationDispatcher` and `CertificateProcessor` no-op interfaces.
- Internal dispatch route: `POST /api/internal/submissions/:id/dispatch`.

## Data contracts

- Role enum: `owner | manager`
- Job status enum: `pending | processing | verified | failed`
- Staff and certification writes validated by Zod schemas.

## Next phase handoff

- Add public staff intake route (`/{orgSlug}`).
- Implement queue worker and browser verification.
- Add PDF stamping and retrieval features.
