# Feature Overview

## 1) Organization setup
- Create organization profile and URL slug.
- Add manager accounts.

## 2) Staff roster management
- Paste parser for bulk names (newline/comma/tab input).
- Auto-split first/last names with lightweight normalization.
- Quick edit/remove actions.

## 3) Staff intake by org slug
- Public org page (`/{orgSlug}`) accepts first name, last name, and required eCard codes.
- Submission handling checks for roster match.

## 4) Name mismatch handling
- Exact match first.
- Fuzzy candidate suggestions for likely matches.
- Manager review path if certificate name differs.

## 5) Verification pipeline
- Async queue job per certification requirement.
- Throttled programmatic browser for source verification and PDF download.
- Retry logic and terminal failure states.

## 6) PDF stamping + storage
- Save source PDF.
- Overlay typewriter-style timestamp.
- Save stamped PSV file and metadata.

## 7) Retrieval and audit
- Manager search/download of latest PSV docs.
- History of attempts and outcomes.
- Audit entries for key system events.

## MVP boundaries
- Prioritize clear status tracking and correctness over advanced UI.
- Avoid deep customization until real usage patterns require it.
