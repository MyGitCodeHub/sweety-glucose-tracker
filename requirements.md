# Sweety — Requirements

**Assessment:** Kenpath Technologies · Junior Full Stack Developer – JavaScript & AI  
**Submission deadline:** Sunday, 29 November 2026 (exact time not specified).  
**Expected effort:** 10–15 hours.  
**Source of truth:** Original assignment email supplied by the applicant. This document distinguishes mandatory requirements from implementation decisions.

## 1. Scope and acceptance criteria

| ID | Mandatory requirement | Acceptance criteria |
|---|---|---|
| AUTH-01 | Register with name, email and password | Valid input creates an account; duplicate email and invalid input are rejected clearly. |
| AUTH-02 | Login | Correct credentials permit access; incorrect credentials do not. |
| AUTH-03 | Password hashing | Store bcrypt hashes only; never return passwords or hashes. |
| AUTH-04 | Data isolation | Every reading and report is scoped to the authenticated user; another user's records cannot be viewed, edited or deleted. |
| READ-01 | Create reading | Save a date, valid slot and integer glucose value in mg/dl. |
| READ-02 | View readings | Display the user's readings for a selected date with slot and value. |
| READ-03 | Edit reading | Update the user's reading, applying the same validation and excluding the current record from duplicate checks. |
| READ-04 | Delete reading | Delete only an owned reading; the UI and reports reflect the change. |
| VAL-01–05 | Validation | All five rules below are enforced server-side and errors are displayed clearly in the UI. |
| REP-01 | Daily report | Selected date only; includes individual readings and slots. |
| REP-02 | Month-to-date report | First day of selected month through selected date, inclusive. |
| REP-03 | Monthly report | Entire calendar month immediately before the selected date's month. |
| REP-04 | Report statistics | Highest, lowest, average rounded to one decimal, and count of readings. |
| REP-05 | Empty reports | A friendly empty state, not misleading zero-valued glucose statistics. |

## 2. Business rules

### Reading slots

Exactly four allowed slots, in display order:

| API/database code | UI label |
|---|---|
| `morning_fasting` | Morning (fasting) |
| `after_breakfast` | After breakfast |
| `after_lunch` | After lunch |
| `after_dinner` | After dinner |

One reading per user, date and slot. Maximum four readings per user per date.

### Validation and messages

Use the assignment's example messages consistently.

| Rule | User-facing message |
|---|---|
| Value missing, null or blank | Please enter a glucose value. |
| Value is not a whole number from 40 to 600 inclusive | Value must be between 40 and 600 mg/dl. |
| Duplicate slot on same date | You already have an After lunch reading for this date. |
| Additional creation on a full day | You can add only 4 readings per day. |
| Future date | Date cannot be in the future. |

Substitute the actual slot label for the duplicate-slot message (e.g., After dinner). Reject missing or invalid dates, unsupported slots and malformed input with clear messages. Validate real calendar dates, not only a date-shaped string. Treat a numeric zero as invalid range, not missing. UI converts a valid input into a JSON number; API rejects non-number values and non-integers. Never silently truncate decimals.

**Chosen precedence:** Validate fields first. For creation, check the full-day limit before the duplicate slot; for edits, exclude the record being edited and reject conflicts with other records. The database unique and slot constraints are the final protection under concurrent requests; map unique violations to an appropriate 409 message (recheck the daily count if needed). A fifth distinct slot is never valid.

### Reports

For selected date 2026-10-15:

- Daily: 2026-10-15.
- Month-to-date: 2026-10-01 through 2026-10-15.
- Monthly: 2026-09-01 through 2026-09-30.

Compute averages over all individual readings, not over daily averages. Count actual stored readings. No readings: count 0; highest, lowest and average null. Render an average such as 120 as 120.0. Handle year transitions and leap years. Sort daily entries by slot order.

## 3. Implementation decisions (not mandated)

- React + Vite, Node.js + Express, PostgreSQL via `pg`, JavaScript, plain CSS.
- Logout and current-user endpoint for a usable authentication flow.
- JWT in an HttpOnly cookie; same-origin app/API model and documented CSRF protections.
- Normalize email by trimming and lowercasing; require nonblank name, valid email and password of at least eight characters, at most 72 UTF-8 bytes (bcrypt limit).
- Asia/Kolkata is the application's calendar timezone; date-only strings use YYYY-MM-DD. The UI and API interpret today consistently. Report dates are restricted to today or earlier as a UI/product choice.
- Local development PostgreSQL; synthetic demo data only. No MongoDB despite the assignment title, because PostgreSQL is expressly required.
- No medical interpretation, alerts, diagnosis, or real patient records.

## 4. Testing acceptance

Automated backend tests should exercise actual HTTP endpoints and a dedicated PostgreSQL test database. Cover registration/login, bcrypt hashing, duplicate email, invalid credentials, unauthenticated requests, all CRUD operations, all five official validation rules, 40/600 boundaries, decimal and malformed values, invalid dates/slots, editing the same slot, edit collisions, per-user isolation, daily/month-to-date/previous-month ranges, rounded averages, empty reports, month/year boundaries and leap years. Include a concurrency test for duplicate creation if feasible. Verify UI errors, navigation, responsive layout and report refresh manually. Frontend automated tests are optional bonus work.

## 5. Optional scope (only after required work passes)

Official bonuses: pagination, monthly line chart, Docker Compose, React Testing Library reading-form tests, Redis report caching, BullMQ reminder log, doctor role.

Preferred order if time remains: reading-form tests, chart, pagination. Defer Docker unless useful; skip Redis, BullMQ and doctor role for this time budget. Deployment is not required. No bonus is a release blocker.

## 6. Submission gate

- [ ] Public GitHub repository with real, meaningful incremental commits.
- [ ] Required functionality and meaningful automated tests pass.
- [ ] README.md explains installation, database setup, running server/client/tests, and demo credentials/setup.
- [ ] .env.example lists all required environment variables with placeholders; no real secrets.
- [ ] Seed script creates a demo user with sample readings; password hashed with bcrypt.
- [ ] Screenshots or 2–3 minute recording of the working app.
- [ ] README Notes: assumptions and improvements with more time.
- [ ] Reply directly to the original Kenpath email with repository link and screenshots or recording.

Internal target: finish required functionality by 28 November; submit early on 29 November or sooner.
