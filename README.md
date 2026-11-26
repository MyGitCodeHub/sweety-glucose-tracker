# Sweety — Blood Glucose Tracker

Full-stack blood glucose tracking web application built for the Kenpath Technologies Junior Full Stack Developer assessment.

## Technology Stack

- **Frontend:** React 19, Vite, React Router, JavaScript (ES modules), plain CSS
- **Backend:** Node.js (v22+), Express 5 (ES modules), bcrypt (`^6.0.0`)
- **Database:** PostgreSQL (`pg` `^8.23.1`; locally tested with PostgreSQL 18.6)

## Current Development Status

**Module 02 (Database Implementation) complete — pending manual verification.**

Implemented:
- Independent `client/` and `server/` npm packages with committed lockfiles
- Express application (`server/src/app.js`) separated from server startup (`server/src/server.js`)
- `GET /api/health` endpoint returning `{"status":"ok"}` without requiring a database connection
- PostgreSQL schema (`server/database/schema.sql`) defining `users` and `glucose_readings` with named integrity constraints
- Connection pool (`server/src/db/pool.js`) with `NODE_ENV=test` isolation, `DATE` (`YYYY-MM-DD`) string preservation, and sanitized errors
- Startup database connectivity verification in `server/src/server.js`
- Idempotent demo seed script (`server/database/seed.js`) generating synthetic readings in `Asia/Kolkata` across current and previous calendar months
- Minimal Sweety React status page fetching `/api/health` via the Vite `/api` dev proxy

Not yet implemented (upcoming modules):
- User registration, login, logout, and JWT cookie authentication (Module 03)
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

Copy `server/.env.example` to `server/.env` and fill in your local credentials, secret, and `DEMO_PASSWORD` (at least 8 characters, at most 72 UTF-8 bytes):

```bash
cp server/.env.example server/.env
```

Never commit `server/.env` or real credentials. `server/.env.example` must contain only safe placeholders.

### 4. Initialize database schemas

Apply `server/database/schema.sql` to both databases (the script uses `CREATE TABLE IF NOT EXISTS` and is safe to re-run):

```bash
psql "$DATABASE_URL" -f server/database/schema.sql
psql "$TEST_DATABASE_URL" -f server/database/schema.sql
```

*(If those variables are not exported in your shell, pass the explicit connection URLs or `-U sweety_app -d sweety_dev` / `-U sweety_test_app -d sweety_test`.)*

### 5. Seed demo data (development database only)

```bash
cd server
npm run seed
```

**Seed behavior:**
- Creates synthetic user `demo@sweety.example` using the password from `DEMO_PASSWORD` (hashed with bcrypt cost `12`).
- Generates synthetic readings across today, earlier days of the current calendar month, and the previous calendar month using `Asia/Kolkata` dates (never future dates).
- **Repeated runs are idempotent:** if `demo@sweety.example` already exists, `seed.js` preserves the existing password hash, name, and readings without overwriting them, and inserts only missing slot/date rows (`ON CONFLICT DO NOTHING`).
- **Test-database safety:** `seed.js` refuses to run when `NODE_ENV=test`, when `DATABASE_URL` matches `TEST_DATABASE_URL`, or when connected to a test database (`sweety_test` or `*_test`).

**Demo login email:** `demo@sweety.example` (use the password configured in your local `server/.env` `DEMO_PASSWORD` once authentication endpoints are implemented in Module 03).

### 6. Run and restart the backend server

Start (or manually restart after stopping with `Ctrl+C`) using the non-watch startup command:

```bash
cd server
npm run dev
```

*(Uses `node --env-file-if-exists=.env src/server.js` — non-watch mode avoids Node `--watch` `EPIPE` errors.)*

The server verifies PostgreSQL connectivity before listening on `http://localhost:3001`.

### 7. Run the frontend dev server

In a second terminal:

```bash
cd client
npm run dev
```

The Vite dev server listens on `http://localhost:5173` (`strictPort: true`) and proxies `/api` requests to `http://localhost:3001`.

### 8. Verify health endpoint and database state

Check the backend health endpoint directly and through the Vite proxy:

```bash
curl -i http://localhost:3001/api/health
curl -i http://localhost:5173/api/health
```

Inspect tables and verify demo seed counts without exposing password hashes:

```bash
psql -U sweety_app -d sweety_dev -c "\d+ users" -c "\d+ glucose_readings"
psql -U sweety_app -d sweety_dev -c "SELECT id, name, email, left(password_hash, 7) AS hash_prefix FROM users WHERE email = 'demo@sweety.example';"
psql -U sweety_app -d sweety_dev -c "SELECT date_trunc('month', reading_date)::date AS month, count(*) FROM glucose_readings GROUP BY 1 ORDER BY 1;"
```

Build the frontend for production:

```bash
cd client
npm run build
```

## Notes

- Planning and specification baseline documents: `requirements.md`, `architecture.md`, `design.md`, and `AGENTS.md`.
- Assumptions and future improvements will be expanded here as modules are completed.
