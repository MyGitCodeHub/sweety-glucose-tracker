# Sweety — Technical Architecture

Status: agreed planning baseline, not an implemented system. Requirements.md (filename `requirements.md`) and the original assignment take precedence over technical preferences.

## 1. Design

React browser UI → same-origin `/api` requests → Express middleware/routes → parameterized `pg` queries → PostgreSQL.

Use JavaScript ES modules consistently. React Router handles login, signup and protected dashboard routes. Use Fetch, React state/context for authentication, and plain CSS. No ORM, global state framework or microservices. Vite proxies `/api` to Express in development; a same-origin production setup can serve the built client from Express or a reverse proxy if needed.

## 2. Repository layout

```text
sweety-glucose-tracker/
  requirements.md
  architecture.md
  design.md
  AGENTS.md
  README.md
  .gitignore
  client/
    src/
      components/
      pages/
      context/
      services/
      styles/
  server/
    src/
      app.js
      server.js
      db/
      routes/
      middleware/
      validators/
      services/       # only when shared logic merits it
    database/
      schema.sql
      seed.js
    tests/
    .env.example
  screenshots/
```

Separate Express app creation from listening so Supertest can test it without opening a fixed port. Keep files small but do not add empty architectural layers. Commit package lockfiles.

## 3. PostgreSQL schema contract

| Table | Column | Type and constraint |
|---|---|---|
| users | id | integer identity, primary key |
| users | name | text, not null |
| users | email | text, not null, unique; stored lowercase and trimmed |
| users | password_hash | text, not null |
| users | created_at | timestamptz, not null, default now() |
| glucose_readings | id | integer identity, primary key |
| glucose_readings | user_id | integer, not null, foreign key → users.id |
| glucose_readings | reading_date | date, not null |
| glucose_readings | time_slot | text, not null, check against four slot codes in requirements.md |
| glucose_readings | glucose_value | integer, not null, check 40–600 inclusive |
| glucose_readings | created_at | timestamptz, not null, default now() |
| glucose_readings | updated_at | timestamptz, not null, default now(); set on update |

Unique constraint: (user_id, reading_date, time_slot). This both prevents duplicate slots under concurrent writes and enforces the four-reading maximum when combined with the slot check. The unique index also supports user/date filters. Future-date validation belongs in the API, using the chosen calendar timezone; do not use a moving date expression in a static check constraint. All reading queries scope by user_id obtained from verified authentication, never from the request body. For updates and deletes, filter by id AND user_id in the SQL statement itself. Return date-only values as YYYY-MM-DD strings, avoiding JavaScript Date timezone shifts.

## 4. API contracts

Base path `/api`. JSON body and response unless stated otherwise. Field names below are camelCase. Error shape: `{ "error": { "code": "...", "message": "..." } }`. Never expose raw SQL errors or stack traces.

| Method | Path | Input | Success |
|---|---|---|---|
| GET | /health | None | 200, minimal status |
| POST | /auth/register | name, email, password | 201, public user fields; then login separately |
| POST | /auth/login | email, password | 200, public user fields and authentication cookie |
| POST | /auth/logout | None | 204, clear cookie |
| GET | /auth/me | Cookie | 200, public user fields |
| GET | /readings?date=YYYY-MM-DD | Cookie, optional date (default today) | 200, readings array in slot order |
| POST | /readings | date, slot, value | 201, created reading |
| PUT | /readings/:id | date, slot, value | 200, updated reading |
| DELETE | /readings/:id | Cookie | 204 |
| GET | /reports/daily?date=YYYY-MM-DD | Cookie, optional date (default today) | 200, report and readings |
| GET | /reports/month-to-date?date=YYYY-MM-DD | Cookie, optional date (default today) | 200, report |
| GET | /reports/monthly?date=YYYY-MM-DD | Cookie, optional date (default today) | 200, previous-month report |

Public user fields: `id`, `name`, `email`. Reading fields: `id`, `date`, `slot`, `value`. Reports: `startDate`, `endDate`, `highest`, `lowest`, `average`, `count`; daily also includes `readings`. Report range endpoints are inclusive; empty statistics are null and count zero. Average is numeric rounded to one decimal; frontend formats with one trailing decimal digit. Report numbers must be explicitly converted from PostgreSQL numeric/string results to JSON numbers. Daily details and stats should agree (derive from the same fetched rows or a consistent database snapshot).

Errors: 400 invalid fields/dates/IDs, 401 missing or invalid authentication / invalid login, 403 rejected origin, 404 missing or not-owned reading, 409 duplicate email/slot or full day, 429 rate limit, 500 generic unexpected failure. Use stable error codes such as `VALUE_REQUIRED`, `VALUE_RANGE`, `DUPLICATE_SLOT`, `DAILY_LIMIT`, `FUTURE_DATE`. See requirements.md for messages. Never accept a userId from a reading request.

## 5. Security decisions

- Use bcrypt (cost 12 proposed; benchmark locally) and enforce its 72-byte input limit before hashing. Normalize emails and handle unique constraint violations safely. Generic incorrect-login message.
- Sign JWT with a strong random secret and explicit algorithm; verify algorithm, signature and expiration. Use user ID as subject. Proposed 8-hour lifetime; cookie lifetime matches. Do not store token in localStorage or expose it in JSON.
- Cookie: HttpOnly, SameSite=Lax, Path=/, Secure in HTTPS production; clear using matching options on logout. JWT logout clears browser cookie, not revocation of already copied tokens; document this limitation. No refresh-token system needed.
- Same-origin browser requests via Vite proxy. Verify Origin against configured trusted origin on state-changing browser requests (reject foreign origins; document handling of missing Origin, use explicit trusted Origin in API tests); accept JSON for mutations with bodies. No permissive credentialed CORS. If using a production proxy, configure trust narrowly and require HTTPS.
- Use Helmet, login/signup rate limiting, request body size limit, parameterized SQL, generic server errors. Do not log passwords, tokens, connection strings or glucose payloads. Use fake data only.
- Keep `.env` out of Git; fail startup on missing required configuration; use non-superuser database credentials. Never run destructive operations on development or production data during tests.

## 6. Proposed environment contract

Maintain `server/.env.example` at implementation time; ensure README includes all variables actually used.

| Variable | Purpose |
|---|---|
| PORT | Express port, e.g. 3001 |
| DATABASE_URL | Development PostgreSQL connection string |
| TEST_DATABASE_URL | Dedicated test PostgreSQL connection string |
| JWT_SECRET | Random secret, no real value committed |
| APP_ORIGIN | Trusted browser origin, e.g. http://localhost:5173 |
| NODE_ENV | development, test or production |
| DEMO_PASSWORD | Local synthetic demo user's password for seed script |

Fix the app calendar timezone to Asia/Kolkata in date helpers; document it. If additional configuration is needed, update the example and README together. Seed script should be repeatable without deleting unrelated data, hash the demo password, and create readings relative to today across current and previous months. Never seed real patient data. Tests must refuse to run unless the dedicated test database URL is configured and verified distinct from the dev database; use controlled fixtures, clean only the test database, and close pools after tests.

## 7. Test and delivery approach

Vitest + Supertest with actual isolated PostgreSQL fixtures. Test business rules and data isolation before connecting the frontend. Use browser/manual testing for login, logout, CRUD, errors, reports and responsive screens. Use a deterministic date helper or controlled clock for calendar boundary tests. Prefer a small set of clear integration tests over superficial coverage metrics. Add React Testing Library only when mandatory work is green.

Modules: 01 scaffold/Git → 02 database and seed → 03 authentication + tests → 04 readings + tests → 05 reports + tests → 06 React UI → 07 integration → 08 final QA → 09 README/demo/submission. Build and commit each verified increment. No automatic push or destructive commands.
