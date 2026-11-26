# Sweety — Blood Glucose Tracker

Full-stack blood glucose tracking web application built for the Kenpath Technologies Junior Full Stack Developer assessment.

## Technology Stack

- **Frontend:** React 19, Vite, React Router, JavaScript (ES modules), plain CSS
- **Backend:** Node.js (v22+), Express 5 (ES modules)
- **Database:** PostgreSQL (via `pg`, to be configured in Module 02)

## Current Development Status

**Module 01 (Project Initialization & Scaffolding) complete — pending manual verification.**

Implemented:
- Independent `client/` and `server/` npm packages with committed lockfiles
- Express application (`server/src/app.js`) separated from server startup (`server/src/server.js`)
- `GET /api/health` endpoint returning `{"status":"ok"}` without requiring a database connection
- `server/.env.example` template with planned environment variables
- Minimal Sweety React status page fetching `/api/health` via the Vite `/api` dev proxy

Not yet implemented (upcoming modules):
- PostgreSQL schema and seed script (Module 02)
- User registration, login, and JWT cookie authentication (Module 03)
- Blood glucose reading CRUD and validation rules (Module 04)
- Daily, month-to-date, and previous-month reports (Module 05)
- Full React authentication and dashboard UI (Module 06)

## Verified Setup Instructions

### Prerequisites

- Node.js v22+ and npm 9+
- PostgreSQL 18+ (required starting in Module 02)

### 1. Install dependencies

Run in separate terminals or sequentially:

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables (optional for Module 01)

The Express server defaults to port `3001` if `server/.env` is not yet created. To customize `PORT` or prepare for upcoming modules:

```bash
cp server/.env.example server/.env
```

### 3. Run the backend server

```bash
cd server
npm run dev
```

The API server listens on `http://localhost:3001`.

### 4. Run the frontend dev server

In a second terminal:

```bash
cd client
npm run dev
```

The Vite dev server listens on `http://localhost:5173` (with `strictPort` enabled) and proxies `/api` requests to `http://localhost:3001`.

### 5. Verify health endpoint and production build

Check the backend directly and through the Vite proxy:

```bash
curl -i http://localhost:3001/api/health
curl -i http://localhost:5173/api/health
```

Build the frontend for production:

```bash
cd client
npm run build
```

## Notes

- Planning and specification baseline documents: `requirements.md`, `architecture.md`, `design.md`, and `AGENTS.md`.
- Assumptions and future improvements will be expanded here as modules are completed.
