# Sweety — Blood Glucose Tracker

Personal blood glucose tracking web application built for the Kenpath Technologies Junior Full Stack Developer (JavaScript & AI) assessment.

## Demo Video

- **Application Walkthrough:** [Watch the Sweety Demo Video on Google Drive](https://drive.google.com/file/d/1J5QSipyPollSGlJt2OpViDkk-ORJ2z_m/view?usp=drivesdk)

## Overview

Sweety allows patients to create an account, log in securely, manage up to four blood glucose readings per calendar day across fixed meal/time slots, and review Daily, Month-to-Date, and Monthly summary statistics. All server validation, date calculations, report aggregations, and user-ownership checks are enforced in the Express/PostgreSQL backend and surfaced through a responsive, accessible React interface.

### Main Features

- **Account authentication:** Registration, login, logout, and persistent session checks using bcrypt-hashed passwords and `HttpOnly` JWT cookies.
- **Glucose readings management:** Create, view, edit, and delete daily readings across four canonical slots (`Morning (fasting)`, `After breakfast`, `After lunch`, `After dinner`) with whole-number validation (`40–600 mg/dl`), duplicate-slot prevention, and a 4-reading daily cap.
- **Summary reports:** Daily, Month-to-Date (inclusive from the 1st of the selected month through the selected date), and Monthly (full previous calendar month) summaries displaying highest, lowest, individual-reading average rounded to 1 decimal place, unitless reading count, and friendly empty states (`—`).
- **Accessible & responsive UI:** Semantic landmarks, keyboard-accessible tabs and native `<dialog>` forms, clear error/success announcements, and fluid layouts down to `320px`.
- **Automated testing (including official bonus):** 58 backend Vitest + Supertest integration tests plus the implemented official bonus task—12 frontend reading form tests using React Testing Library and Vitest (**70 passing automated tests total**).

### Technology Stack

- **Frontend:** React 19, Vite, React Router, JavaScript (ES modules), plain CSS
- **Backend:** Node.js (v22+), Express 5 (ES modules), `bcrypt`, `jsonwebtoken`, `cookie-parser`, `helmet`, `express-rate-limit`
- **Database:** PostgreSQL (`pg`)
- **Testing:** Vitest 5, Supertest 7, React Testing Library, jsdom, `@testing-library/jest-dom`, `@testing-library/user-event`

---

## Setup Instructions

### Prerequisites

- **Node.js** `v22+` and **npm** (tested with Node `v22.22.1` and npm `9.2.0`)
- **PostgreSQL** (`v15+`, locally tested with PostgreSQL `18.6`)
- **Git**

### 1. Clone the repository

```bash
git clone https://github.com/MyGitCodeHub/sweety-glucose-tracker.git
cd sweety-glucose-tracker
```

### 2. Install dependencies

Install server and client packages separately using the committed lockfiles:

```bash
cd server && npm ci
cd ../client && npm ci
cd ..
```

### 3. Create PostgreSQL roles, databases, and schema permissions

Connect to PostgreSQL as an administrative superuser (such as `postgres`) to create dedicated, least-privilege development and test roles and databases, and grant schema `public` ownership/creation privileges required on PostgreSQL 15+ (replace placeholder passwords before running):

```sql
CREATE ROLE sweety_app WITH LOGIN PASSWORD 'replace_with_dev_password';
CREATE ROLE sweety_test_app WITH LOGIN PASSWORD 'replace_with_test_password';

CREATE DATABASE sweety_dev OWNER sweety_app;
CREATE DATABASE sweety_test OWNER sweety_test_app;

\c sweety_dev
ALTER SCHEMA public OWNER TO sweety_app;
GRANT ALL ON SCHEMA public TO sweety_app;

\c sweety_test
ALTER SCHEMA public OWNER TO sweety_test_app;
GRANT ALL ON SCHEMA public TO sweety_test_app;
```

### 4. Configure environment variables

Copy the example template and update `server/.env` with your local values:

```bash
cp server/.env.example server/.env
```

Required variables in `server/.env`:

- `PORT`: Express listening port (default `3001`)
- `DATABASE_URL`: Development PostgreSQL URL (`postgresql://sweety_app:...@localhost:5432/sweety_dev`)
- `TEST_DATABASE_URL`: Dedicated test PostgreSQL URL (`postgresql://sweety_test_app:...@localhost:5432/sweety_test`; must differ from `DATABASE_URL`)
- `JWT_SECRET`: Random secret at least **32 UTF-8 bytes** long (no fallback secret exists)
- `APP_ORIGIN`: Exact trusted browser origin (e.g., `http://localhost:5173`) with no trailing slash, path, query, or embedded credentials
- `NODE_ENV`: `development`, `test`, or `production`
- `DEMO_PASSWORD`: Local demo user password (`>= 8` characters, `<= 72` UTF-8 bytes) used by `npm run seed`

Never commit `server/.env` or real credentials. `server/.env.example` contains safe placeholders only.

### 5. Initialize schemas for both databases

Run the schema initialization commands directly from the repository root (enter each role password when prompted):

```bash
psql -h localhost -U sweety_app -d sweety_dev -W -f server/database/schema.sql
psql -h localhost -U sweety_test_app -d sweety_test -W -f server/database/schema.sql
```

`server/database/schema.sql` uses `CREATE TABLE IF NOT EXISTS` and is safe to re-run.

### 6. Seed synthetic demo data (development database only)

Ensure `DEMO_PASSWORD` is configured in `server/.env`, then run:

```bash
cd server
npm run seed
```

- **Demo login email:** `demo@sweety.example`
- **Demo login password:** The `DEMO_PASSWORD` value you set locally in `server/.env` before running `npm run seed`.
- Repeated runs are idempotent and preserve an existing `demo@sweety.example` account while skipping already-present readings.
- `seed.js` refuses to run against `NODE_ENV=test`, `sweety_test`, `*_test`, or when `DATABASE_URL` matches `TEST_DATABASE_URL`.

### 7. Start the backend and frontend servers

In Terminal 1 (backend API on `http://localhost:3001`):

```bash
cd server
npm run dev
```

In Terminal 2 (Vite dev server on `http://localhost:5173`, proxying `/api` to `localhost:3001`):

```bash
cd client
npm run dev
```

Open the application in Chrome at: **http://localhost:5173**

---

## Testing and Verification

### Automated Test Results Summary

- **Backend:** 58 passing automated integration tests (`cd server && npm test`)
- **Frontend (Official Bonus Task):** 12 passing reading form tests using React Testing Library and Vitest (`cd client && npm test`)
- **Total:** **70 passing automated tests**

### Backend Automated Integration Tests

Run the 58 Vitest + Supertest integration tests sequentially against `sweety_test`:

```bash
cd server
npm test
```

Coverage across `server/tests/auth.test.js` (27 tests), `server/tests/readings.test.js` (18 tests), and `server/tests/reports.test.js` (13 tests):
- User registration, email normalization, bcrypt hashing, 72-byte password boundary, duplicate-email concurrency, login cookies, JWT validation (`HS256`, `exp`, integer `sub`), logout, Origin CSRF protection, and auth rate limiting.
- Glucose readings CRUD, `40`/`600` integer boundaries, decimal/zero/type rejection, all five mandatory validation rules and precedence (`DAILY_LIMIT` before `DUPLICATE_SLOT`), full-day editing, per-user ownership isolation, and concurrent slot/limit locking.
- Daily, Month-to-Date, and Monthly calendar ranges (including leap years, year transitions, and `Asia/Kolkata` midnight boundaries), individual-reading averages rounded to 1 decimal place, empty `null` states, and `Cache-Control: no-store` headers.
- Strict test database isolation: `server/vitest.config.js` sets `fileParallelism: false`, `server/src/db/pool.js` refuses to run tests if `TEST_DATABASE_URL` is missing or matches `DATABASE_URL`, and `server/tests/helpers/db.js` verifies `current_database() === 'sweety_test'` and `current_user === 'sweety_test_app'` on the exact connection before executing `TRUNCATE`.

### Frontend Reading Form Tests (Official Bonus Task — React Testing Library & Vitest)

Run the 12 automated React Testing Library tests for `ReadingForm` (`client/src/components/ReadingForm.test.jsx`) using Vitest and `jsdom`:

```bash
cd client
npm test
```

Coverage across `ReadingForm.test.jsx` (12 tests, mocking `readingsService.js` without hitting the backend or PostgreSQL):
- Client validation and official messages for empty values, values below `40` (including `0`), values above `600`, fractional inputs (`120.5`), and future `Asia/Kolkata` dates.
- Backend API error handling for `409 DUPLICATE_SLOT` and `409 DAILY_LIMIT`, preserving all user-entered fields when submission fails.
- Create submission payload shape (integer numeric `value`), edit-mode prefilling, update submission with reading ID, and pending-state control disabling / duplicate-request prevention.

### Frontend Lint and Production Build

Run static linting and build the client bundle:

```bash
cd client
npm run lint
npm run build
```

### Manual Browser Verification

With both servers running (`http://localhost:5173`), verify in Chrome across `320px`, `768px`, and `1280px` viewports:
1. Unauthenticated access to `/`, `/readings`, and `/reports` redirects to `/login` without flashing protected content.
2. Registration, login with `demo@sweety.example` (or a new account), reload persistence via `/api/auth/me`, and logout.
3. Creating, editing, and deleting readings on Dashboard and Readings, confirming inline validation errors (`VALUE_REQUIRED`, `VALUE_RANGE`, `FUTURE_DATE`, `DUPLICATE_SLOT`, `DAILY_LIMIT`) preserve inputs and update reports immediately.
4. Daily, Month-to-Date, and Monthly report tabs, 1-decimal average formatting, and `—` empty states.
5. Keyboard-only navigation (`Tab`, `ArrowLeft`/`ArrowRight` on tabs, `Escape` closing dialogs with focus restoration) and network error/recovery handling.

---

## API Documentation

Base path: `/api`. Requests and responses use JSON unless noted (`204 No Content` returns an empty body). Error responses follow `{ "error": { "code": "...", "message": "..." } }`.

### Health & Authentication

| Method | Path | Auth / Headers | Success Response |
|---|---|---|---|
| `GET` | `/api/health` | None | `200` `{ "status": "ok" }` |
| `POST` | `/api/auth/register` | `Origin` + JSON `{ name, email, password }` | `201` `{ id, name, email }` (no cookie set) |
| `POST` | `/api/auth/login` | `Origin` + JSON `{ email, password }` | `200` `{ id, name, email }` + `Set-Cookie: sweety_token=...` |
| `POST` | `/api/auth/logout` | `Origin` | `204` empty body + clears `sweety_token` cookie |
| `GET` | `/api/auth/me` | `sweety_token` cookie | `200` `{ id, name, email }` |

### Glucose Readings

All `/api/readings` routes require a valid `sweety_token` cookie (`401 UNAUTHORIZED` otherwise). Mutations (`POST`, `PUT`, `DELETE`) also require a trusted `Origin` matching `APP_ORIGIN` (`403 FORBIDDEN_ORIGIN` otherwise).

| Method | Path | Request | Success Response |
|---|---|---|---|
| `POST` | `/api/readings` | `Origin` + Cookie + JSON `{ date, slot, value }` | `201` `{ id, date, slot, value }` |
| `GET` | `/api/readings` | Cookie + optional `?date=YYYY-MM-DD` (defaults to `Asia/Kolkata` today) | `200` `[{ id, date, slot, value }, ...]` in slot order (`[]` if none) |
| `PUT` | `/api/readings/:id` | `Origin` + Cookie + JSON `{ date, slot, value }` | `200` `{ id, date, slot, value }` |
| `DELETE` | `/api/readings/:id` | `Origin` + Cookie | `204` empty body |

- **Canonical `slot` codes and labels (in display order):**
  1. `morning_fasting` — `Morning (fasting)`
  2. `after_breakfast` — `After breakfast`
  3. `after_lunch` — `After lunch`
  4. `after_dinner` — `After dinner`
- **Validation messages and precedence:**
  - Missing, `null`, or blank value: `"Please enter a glucose value."` (`400 VALUE_REQUIRED`)
  - Non-integer or outside `40–600` (including `0` and decimals): `"Value must be between 40 and 600 mg/dl."` (`400 VALUE_RANGE`)
  - Future calendar date (`> today` in `Asia/Kolkata`): `"Date cannot be in the future."` (`400 FUTURE_DATE`)
  - Exceeding 4 readings per user per day: `"You can add only 4 readings per day."` (`409 DAILY_LIMIT`, checked before duplicate slot)
  - Duplicate slot on the same date: `"You already have a/an <Slot Label> reading for this date."` (`409 DUPLICATE_SLOT`)
  - Nonexistent or foreign-owned reading ID: `"Reading not found."` (`404 READING_NOT_FOUND`)

### Glucose Reports

All `/api/reports/*` endpoints require a valid `sweety_token` cookie and accept an optional `?date=YYYY-MM-DD` parameter (defaulting to today in `Asia/Kolkata`; blank, malformed, impossible, or repeated dates return `400 INVALID_DATE`, and future dates return `400 FUTURE_DATE`).

| Method | Path | Date Range (Inclusive) | Response (`200`) |
|---|---|---|---|
| `GET` | `/api/reports/daily` | `selectedDate` through `selectedDate` | `{ startDate, endDate, highest, lowest, average, count, readings }` |
| `GET` | `/api/reports/month-to-date` | `YYYY-MM-01` through `selectedDate` | `{ startDate, endDate, highest, lowest, average, count }` |
| `GET` | `/api/reports/monthly` | Full previous calendar month before `selectedDate`'s month | `{ startDate, endDate, highest, lowest, average, count }` |

- Averages are weighted across all individual stored readings in the range and rounded to 1 decimal place (`120.0 mg/dl` in the UI).
- When no readings match the range, `highest`, `lowest`, and `average` are `null` (`—` in the UI), `count` is `0`, and `/daily` returns `readings: []`.

---

## Security Measures

- **Password hashing:** Passwords are hashed with `bcrypt` (cost factor `12`), enforcing the 72 UTF-8 byte bcrypt limit before hashing/verification and never returning hashes in JSON responses.
- **HttpOnly cookie authentication:** JWTs (`HS256`, 8-hour `exp`, integer user `sub`) are stored only in an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie (`Secure` enabled when `NODE_ENV=production`), avoiding `localStorage`/`sessionStorage` token storage. *(Limitation: stateless JWT logout clears the browser cookie rather than maintaining a server-side token revocation list.)*
- **CSRF Origin validation:** Mutating `/api` requests verify an exact `Origin` match against `APP_ORIGIN`, rejecting missing, malformed, or cross-origin mutations with `403 FORBIDDEN_ORIGIN`.
- **Parameterized SQL & ownership isolation:** All queries use `pg` parameterized placeholders (`$1, $2, ...`) and filter exclusively by `req.user.id` derived from the verified JWT and active user row lookup.
- **API cache protection:** Centralized `/api` middleware sets `Cache-Control: no-store` on all authentication, reading, report, and error responses without disabling caching for static assets.
- **Login & signup rate limiting:** `express-rate-limit` restricts `/api/auth/register` and `/api/auth/login` to **20 requests per IP per 15 minutes** (`429 RATE_LIMITED`) outside `NODE_ENV=test` (in-memory store; resets on restart).
- **Environment variable protection:** `.env` files are gitignored, startup fails closed when `JWT_SECRET`, `APP_ORIGIN`, or database URLs are missing/invalid, and `server/.env.example` contains placeholders only.

---

## Notes

### Assumptions

- **Calendar timezone:** All date-only (`YYYY-MM-DD`) defaults, future-date checks, and report boundaries use `Asia/Kolkata`.
- **Glucose value format:** Readings are stored and validated strictly as whole integers in `mg/dl` between `40` and `600` inclusive.
- **Fixed daily slots:** Exactly four daily slots (`morning_fasting`, `after_breakfast`, `after_lunch`, `after_dinner`) are supported, with at most one reading per slot per day.
- **Monthly report definition:** The Monthly report always covers the entire calendar month immediately preceding the selected reference date's month.
- **Fictional data & non-diagnostic scope:** Seeded and sample readings are entirely synthetic; Sweety is intended solely for personal tracking and provides no medical diagnosis or treatment advice.
- **Local dev proxy:** During local development, the Vite dev server proxies same-origin `/api` requests from `http://localhost:5173` to Express on `http://localhost:3001`.

### Improvements with More Time

*(The items below are potential future enhancements beyond the currently implemented assessment scope.)*

- **Expanded frontend component test coverage:** While the official bonus `ReadingForm` tests (12 Vitest + React Testing Library tests) are implemented, adding unit and interaction tests for `ConfirmDialog`, `DashboardPage`, and `ReportTabs` would increase frontend coverage further.
- **Automated end-to-end browser tests:** Playwright/Cypress suites exercising full auth, CRUD, report refresh, and responsive flows against a live database.
- **Optional monthly trend visualization:** Lightweight, accessible chart view alongside the numeric summary cards.
- **Pagination / date-range browsing:** Server-backed pagination for multi-day or multi-month reading history tables.
- **Production deployment & monitoring:** Reverse-proxy TLS termination, structured request logging, external store for rate limiting (e.g., Redis), and health/metrics dashboards.
- **Expanded accessibility auditing:** Automated CI axe/Lighthouse checks across every authenticated state and breakpoint.
- **Further session-management hardening:** Server-side token revocation or short-lived rotating sessions for immediate multi-device logout.
