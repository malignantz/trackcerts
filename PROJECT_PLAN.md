# TrackCerts: MVP Plan (Simple + Effective)

## Why this app exists
Medical facilities need a reliable way to produce Primary Source Verification (PSV) PDFs for staff certifications. The app should make PSV retrieval and storage straightforward, with minimal UI complexity and strong operational reliability.

## Product goals (MVP)
1. Let managers create an organization workspace and maintain a staff list quickly.
2. Let staff submit their eCard codes through an org-specific link (e.g., `/hospital`).
3. Run asynchronous, throttled verification jobs that fetch certification PDFs via browser automation.
4. Stamp each PDF with a typewriter-style timestamp and store it for later download.
5. Allow authorized organization users to retrieve PSV documents when needed.

## Non-goals (for MVP)
1. No complex HRIS integrations.
2. No advanced role matrix beyond practical manager/admin access.
3. No heavy analytics dashboard.
4. No broad workflow customization.

## Plan verification (must pass before implementation)
- Workflow completeness: Manager flow, staff submission flow, and retrieval flow are all defined end-to-end.
- Failure handling exists for name mismatches, bad eCard codes, retries, and throttling.
- Data model supports auditability (timestamps, status history, source metadata).
- UI remains minimal and task-oriented.
- Implementation is phased so each phase is testable and deployable.

## App-wide explanation
The app has three simple layers:
1. **Web app (SvelteKit UI + API routes)**
- Manager UI for org setup, staff list, and status monitoring.
- Staff intake page for name + eCard code submission.
- API endpoints for submissions, status checks, and downloads.

2. **Core backend services**
- Validation and matching service (maps submitted names to staff records).
- Job dispatcher that enqueues verification requests.
- Certificate processing service that stamps timestamps onto PDFs.

3. **Worker + storage**
- Throttled worker uses a programmatic browser to verify eCard codes and download PDFs.
- Persistent storage keeps original and stamped PDFs.
- Database stores staff records, submissions, job states, and audit logs.

End-to-end behavior:
- Staff submits name + eCard data.
- System matches the person and enqueues verification.
- Worker fetches certificate PDF.
- Processor timestamps/stamps PDF.
- Organization can download PSV later.

## Feature/component-wide explanation

### 1) Organization + manager onboarding
- Create organization (name, slug like `/hospital`).
- Invite manager users.
- Configure certifications required (three cert types).

### 2) Staff roster management
- Paste-in name list parser (accept newline/comma/tab formats).
- Intelligent first/last splitting for common formats (`Last, First`, `First Last`, middle initials).
- Deduping suggestions before insert.
- Remove/edit entries quickly.

### 3) Staff submission page (`/{orgSlug}`)
- Staff enters first name, last name, and eCard codes.
- Exact/near match logic to staff roster.
- If match found, create submission + queue jobs.
- If mismatch, provide suggested correction path.

### 4) Verification job pipeline
- Queue receives one job per cert type (or batch per person).
- Worker concurrency + rate limits prevent provider lockouts.
- Retries with capped attempts and terminal failure states.
- Structured logs for each attempt.

### 5) PDF processing + retention
- Store source PDF.
- Apply typewriter-style timestamp overlay.
- Store final stamped PSV PDF.
- Keep metadata: who, cert type, verified-at, source URL/provider, checksum.

### 6) Retrieval + audit trail
- Manager can search staff and download latest PSV.
- History view of prior verification attempts.
- Audit entries for submit, fetch, stamp, and download events.

## Data model (minimal)
1. `organizations`
- id, name, slug, created_at

2. `users`
- id, organization_id, email, role, created_at

3. `staff`
- id, organization_id, first_name, last_name, active, created_at

4. `submissions`
- id, organization_id, staff_id, submitted_first_name, submitted_last_name, submitted_at

5. `ecard_entries`
- id, submission_id, cert_type, ecard_code, status, last_error

6. `verification_jobs`
- id, ecard_entry_id, status, attempt_count, queued_at, started_at, finished_at

7. `documents`
- id, staff_id, cert_type, source_file_path, stamped_file_path, verified_at, checksum

8. `audit_logs`
- id, organization_id, actor_type, actor_id, event_type, payload_json, created_at

## Name mismatch strategy (simple first)
1. Try exact match on normalized first+last.
2. Fall back to fuzzy candidate list (small edit distance + swapped order support).
3. If cert PDF returns a different name, store suggestion for manager review.
4. Manager approves rename or keeps original roster name.

## Suggested implementation phases

### Phase 1: Skeleton + core data
- Bootstrap SvelteKit app, DB schema, auth scaffold, org/staff CRUD.
- Deliverable: manager can create org and staff list.

### Phase 2: Paste parser + staff intake
- Build robust paste parser and intake page by org slug.
- Deliverable: staff submissions create queued records.

### Phase 3: Async verification worker
- Implement queue + throttled browser automation with retries.
- Deliverable: eCard verification runs in background with status updates.

### Phase 4: PDF stamping + downloads
- Timestamp stamping pipeline and secure document downloads.
- Deliverable: manager retrieves stamped PSV documents.

### Phase 5: Mismatch handling + polish
- Name suggestion UX, audit views, error clarity, MVP hardening.
- Deliverable: operationally usable MVP for pilot org.

## MVP acceptance criteria
1. Manager can paste/import staff and edit/remove entries.
2. Staff can submit name + eCard codes from org link.
3. Jobs run asynchronously with throttling and visible statuses.
4. Verified certificates become stamped PDFs stored for later download.
5. Managers can retrieve PSV docs and inspect basic audit history.

## Engineering principles for this project
1. Prefer simple synchronous UX with asynchronous backend jobs.
2. Build thin interfaces over explicit states (`pending`, `processing`, `verified`, `failed`).
3. Favor clear logs and auditability over premature abstraction.
4. Add complexity only when repeated operational pain proves it is needed.
