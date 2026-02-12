# App-Wide Overview

## Purpose
TrackCerts helps medical facilities collect eCard codes, verify certifications, and keep stamped PSV PDFs available for retrieval.

## Core architecture
1. **UI (SvelteKit)**
- Manager portal: staff roster, verification status, downloads.
- Staff portal: org-specific intake form (`/{orgSlug}`).

2. **Backend API + domain services**
- Staff submission validation.
- Name matching + mismatch suggestion logic.
- Job dispatch for asynchronous verification.

3. **Worker + storage**
- Throttled browser automation worker fetches source certificates.
- PDF processing applies timestamp stamp.
- Persistent storage keeps source/stamped docs with metadata.

## Canonical workflow
1. Manager defines staff roster.
2. Staff submits name + eCard codes.
3. System matches staff and queues verification jobs.
4. Worker verifies + downloads certificates.
5. PDF processor stamps date/time.
6. Manager downloads PSV documents on demand.

## Reliability and operations
- Explicit job states: `pending`, `processing`, `verified`, `failed`.
- Retry with cap for transient failures.
- Audit trail for submissions, verification attempts, and downloads.
- Throttling to protect upstream certificate providers.

## Design principle
Keep the product operationally clear before making it feature-rich. Optimize for predictable workflows, simple status visibility, and durable records.
