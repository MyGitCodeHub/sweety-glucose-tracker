# Sweety — Blood Glucose Tracker

Full-stack blood glucose tracking web application built for the Kenpath Technologies Junior Full Stack Developer assessment.

## Technology Stack

- **Frontend:** React 19, Vite, React Router, JavaScript (ES modules), plain CSS
- **Backend:** Node.js (v22+), Express 5 (ES modules), `bcrypt`, `jsonwebtoken`, `cookie-parser`, `helmet`, `express-rate-limit`
- **Database:** PostgreSQL (`pg`; locally tested with PostgreSQL 18.6)
- **Testing:** Vitest 5, Supertest 7

## Current Development Status

**Module 03 (Authentication, Security & Automated Testing) complete and verified.**

Implemented:
- Independent `client/` and `server/` npm packages with committed lockfiles
- Express application (`server/src/app.js`) separated from server startup (`server/src/server.js`)
- `GET /api/health` endpoint returning `{"status":"ok"}` without requiring a database connection
- PostgreSQL schema (`server/database/schema.sql`) defining `users` and `glucose_readings` with named integrity constraints
- Connection pool (`server/src/db/pool.js`) with `NODE_ENV=test` isolation, `DATE` (`YYYY-MM-DD`) string preservation, and sanitized errors
- Startup configuration and database connectivity verification in `server/src/server.js`
- Idempotent demo seed script (`server/database/seed.js`) generating synthetic readings in `Asia/Kolkata` across current and previous calendar months
- Authentication APIs (`POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`) with bcrypt cost 12, `HS256` 8-hour JWTs in `HttpOnly` cookies, Helmet security headers, strict CSRF `Origin` validation, and auth rate limiting
- Vitest + Supertest integration test suite (`server/tests/auth.test.js`) isolated to `sweety_test`
- Minimal Sweety React status page fetching `/api/health` via the Vite `/api` dev proxy

Not yet implemented (upcoming modules):
- Blood glucose reading CRUD endpoints and API validation rules (Module 04)
- Daily, month-to-date, and previous-month report endpoints (Module 05)
- Full React authentication and dashboard UI (Module 06)

## Setup Instructions

### Prerequisites

- Node.js (tested on v22.22.1) and npm (tested on 9.2.0)
- PostgreSQL (locally tested on PostgreSQL 18.6)

### 1. Install dependencies

Run in separate terminals or sequentially:

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Create PostgreSQL roles and databases

Create dedicated, least-privilege roles and separate development/test databases (replace placeholder passwords before running):

```sql
CREATE ROLE sweety_app WITH LOGIN PASSWORD 'replace_with_dev_password';
CREATE ROLE sweety_test_app WITH LOGIN PASSWORD 'replace_with_test_password';

CREATE DATABASE sweety_dev OWNER sweety_app;
CREATE DATABASE sweety_test OWNER sweety_test_app;
```

### 3. Configure environment variables

Copy `server/.env.example` to `server/.env` and fill in your local credentials and secrets:

```bash
cp server/.env.example server/.env
```

Required variables for running the server:
- `PORT`: Express port (defaults to `3001`)
- `DATABASE_URL`: Development PostgreSQL connection URL (`sweety_dev` as `sweety_app`)
- `TEST_DATABASE_URL`: Dedicated test PostgreSQL connection URL (`sweety_test` as `sweety_test_app`, must differ from `DATABASE_URL`)
- `JWT_SECRET`: Random secret at least **32 UTF-8 bytes** long (no fallback secret exists)
- `APP_ORIGIN`: Exact trusted browser origin (e.g., `http://localhost:5173`) with no path, query, or embedded credentials
- `NODE_ENV`: `development`, `test`, or `production`
- `DEMO_PASSWORD`: Demo password (`>= 8` characters, `<= 72` UTF-8 bytes) for `npm run seed`

Never commit `server/.env` or real credentials. `server/.env.example` must contain only safe placeholders.

### 4. Initialize database schemas

Apply `server/database/schema.sql` to both databases (the script uses `CREATE TABLE IF NOT EXISTS` and is safe to re-run):

```bash
psql "$DATABASE_URL" -f server/database/schema.sql
psql "$TEST_DATABASE_URL" -f server/database/schema.sql
```

### 5. Seed demo data (development database only)

```bash
cd server
npm run seed
```

- Creates synthetic user `demo@sweety.example` using the password from `DEMO_PASSWORD` (hashed with bcrypt cost `12`).
- Repeated runs are idempotent: if `demo@sweety.example` already exists, its existing password hash, name, and readings are preserved.
- Refuses to run when `NODE_ENV=test`, when `DATABASE_URL` matches `TEST_DATABASE_URL`, or against `sweety_test` / `*_test`.

### 6. Run and restart the backend server

Start (or manually restart after stopping with `Ctrl+C`) using the non-watch startup command:

```bash
cd server
npm run dev
```

### 7. Run the frontend dev server

In a second terminal:

```bash
cd client
npm run dev
```

## Authentication API Contracts

Base path `/api`:

| Method | Path | Request / Auth | Response |
|---|---|---|---|
| `POST` | `/api/auth/register` | `Origin` + JSON `{ name, email, password }` | `201` `{ id, name, email }` (no cookie set; login separately) |
| `POST` | `/api/auth/login` | `Origin` + JSON `{ email, password }` | `200` `{ id, name, email }` + `Set-Cookie: sweety_token=...` |
| `POST` | `/api/auth/logout` | `Origin` | `204` empty body + clears `sweety_token` cookie |
| `GET` | `/api/auth/me` | `sweety_token` cookie | `200` `{ id, name, email }` |

Validation and error rules:
- `name` is trimmed and must be non-blank (`<= 120` chars).
- `email` is trimmed, lowercased, and validated (`409 EMAIL_EXISTS` on duplicate).
- `password` must be `>= 8` chars, not whitespace-only, and `<= 72` UTF-8 bytes (never trimmed or silently truncated).
- Invalid login credentials return a generic `401 INVALID_CREDENTIALS` response.
- Unauthenticated or invalid JWT requests return `401 UNAUTHORIZED`.

## Automated Tests & Test Database Isolation

Run the backend integration test suite against `sweety_test`:

```bash
cd server
npm test
```

Optional watch mode during development:

```bash
cd server
npm run test:watch
```

Test isolation safeguards:
- `server/tests/setup/env.js` loads `server/.env`, forces `NODE_ENV=test`, and sets a dedicated synthetic test-only `JWT_SECRET`.
- `server/vitest.config.js` disables file parallelism (`fileParallelism: false`) to prevent parallel database cleanup conflicts.
- `server/src/db/pool.js` uses `TEST_DATABASE_URL` exclusively when `NODE_ENV=test` and refuses to connect if `TEST_DATABASE_URL` is missing or matches `DATABASE_URL`.
- `server/tests/helpers/db.js` verifies `current_database() === 'sweety_test'` and `current_user === 'sweety_test_app'` via `assertDedicatedTestDatabase(client)` on the **same connection** immediately before executing `TRUNCATE`.

## Manual API Verification (`curl`)

State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require an `Origin` header matching `APP_ORIGIN`:

```bash
# Health check (safe GET, no Origin required)
curl -i http://localhost:3001/api/health

# Register a synthetic test user
curl -i -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"name":"Manual Test","email":"manual.test@example.com","password":"ValidPassword123!"}'

# Login and store HttpOnly cookie in a temporary cookie jar
curl -i -c /tmp/sweety_cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"manual.test@example.com","password":"ValidPassword123!"}'

# Fetch authenticated user profile
curl -i -b /tmp/sweety_cookies.txt http://localhost:3001/api/auth/me

# Verify CSRF rejection when Origin is missing or untrusted (expects HTTP 403)
curl -i -b /tmp/sweety_cookies.txt -X POST http://localhost:3001/api/auth/logout

# Logout with trusted Origin (expects HTTP 204)
curl -i -b /tmp/sweety_cookies.txt -c /tmp/sweety_cookies.txt -X POST http://localhost:3001/api/auth/logout \
  -H "Origin: http://localhost:5173"

rm -f /tmp/sweety_cookies.txt
```

## Security Assumptions & Limitations

- **Cookie policy:** `sweety_token` uses `HttpOnly`, `SameSite=Lax`, `Path=/`, 8-hour `maxAge`, and `Secure` when `NODE_ENV=production`. Production deployment must run behind HTTPS so `Secure` cookies are transmitted by browsers.
- **Stateless JWT logout limitation:** `POST /api/auth/logout` clears the browser cookie only; it does not revoke a previously copied JWT before its 8-hour expiration (`exp`).
- **In-memory rate limiter limitation:** Authentication endpoints (`/register`, `/login`) limit requests to **20 per IP per 15-minute window** (`429 RATE_LIMITED`) using `express-rate-limit`'s default in-memory store, which resets on process restart and is scoped per Node process.
- **Strict Origin policy:** All mutating `/api` requests require an `Origin` header matching `APP_ORIGIN` exactly; missing, malformed, path-bearing, or credential-bearing origins are rejected with `403 FORBIDDEN_ORIGIN`.
- **Separate test database protection:** Automated tests never touch `sweety_dev` and fail closed if `sweety_test` / `sweety_test_app` isolation cannot be verified.

## Notes

- Planning and specification baseline documents: `requirements.md`, `architecture.md`, `design.md`, and `AGENTS.md`.
- Assumptions and future improvements will be expanded here as modules are completed.
