# Phase 3 Implementation Plan: Async Verification Worker (Heart.org Dual-Flow)

## Scope

- Replace inline provider execution with queued async worker processing.
- Support two provider flows:
  - Direct eCard verification (`verify_ecard`) in global batches up to 20 via Employer flow.
  - Name+email lookup (`lookup_name_email`) one submission at a time via Student flow.
- Persist per-entry outcomes, provider error categories, and queue lifecycle state.

## Contract

- `/verify/:siteCode` actions return receipt quickly and only enqueue work.
- Internal dispatch endpoint returns `{ status: "queued" }`.
- Worker CLI:
  - `npm run worker:once`
  - `npm run worker:run`

## Data Model

- `verification_jobs` now includes:
  - `job_type` (`verify_ecard` | `lookup_name_email`)
  - `submission_id` (required)
  - nullable `ecard_entry_id`
  - `last_error`, `error_category`, `claimed_by`
  - index on `(status, queued_at)`
  - partial unique active-job indexes for idempotent enqueue
- `ecard_entries` includes `provider_cert_label` for raw provider labels.

## Worker Behavior

- Claim oldest pending job with transactional lock semantics.
- Lookup path:
  - run Student lookup
  - fail terminal on CAPTCHA (`captcha_detected`)
  - fail terminal on zero results (`no_certs_found`)
  - on success, insert verified `ecard_entries` for all returned certs
  - map known cert types, preserve unknown labels/codes
- Direct verify path:
  - claim additional direct jobs up to configured batch size
  - run Employer verification batch
  - persist per-job and per-entry terminal state
  - roll up submission state from child entry states

## Configuration

- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`
- `WORKER_DIRECT_BATCH_SIZE`
- `WORKER_MAX_ATTEMPTS`
- `WORKER_HEADLESS`
- `HEART_PROVIDER_MODE` (`noop`/`live`)
- `HEART_PROVIDER_BASE_URL`
- `HEART_PROVIDER_EMAIL`
- `HEART_PROVIDER_PASSWORD`

## Test Coverage

- Queue/dispatcher contract updates.
- Verify route integration updated for enqueue-only behavior.
- Worker integration tests cover:
  - lookup success with unknown cert label persistence
  - zero-result lookup failure
  - CAPTCHA terminal failure
  - direct verification >20 batch behavior
  - idempotent enqueue for active direct jobs

## Out of Scope

- PDF download/stamping (Phase 4).
- Multi-node/distributed scheduler.
