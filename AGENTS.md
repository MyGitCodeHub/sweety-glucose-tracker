# Sweety — Agent Development Instructions

## Source of truth and scope

Follow the original Kenpath assessment and `requirements.md` first, then `architecture.md` and `design.md`. The assignment deadline is 29 November 2026; prioritize the required features and meaningful tests. Do not silently change business rules, stack, data contracts or scope. If a decision is unclear, choose the smallest safe approach, explain it and flag it for README Notes. Do not implement optional bonuses until explicitly authorized after the required features pass.

## Module workflow

Work on exactly one user-approved module at a time. Before changing files, inspect existing code and relevant requirements, propose a small implementation plan and list intended files. Do not rewrite working code unnecessarily. Implement only the approved scope. Keep code readable for a fresher to explain. Add or update meaningful tests for the module. Review security, validation, date behavior and error states. Run only approved, safe checks or supply exact commands for the user to run manually. Do not proceed to the next module automatically.

Every module response must include: changes and file paths; reasoning and data flow; actual checks run/results (clearly distinguish not run); remaining limitations and assumptions; manual verification commands; three interview questions; proposed meaningful commit message. Do not claim tests passed if not run.

## Tool and skill policy

Use the available agent action/mode matching the task (planning/read-only for design or review; focused implementation after approval; browser verification for UI if authorized). Exact product labels vary by installation. Use relevant installed skills only: frontend development/testing, backend REST API, PostgreSQL, authentication/security or automated testing as appropriate. Never pretend a skill is installed. MCP is optional: PostgreSQL for read-only schema/query inspection on the designated development/test database; GitHub for repository inspection; browser/Playwright for Chrome verification; Context7 for documentation when connected and useful. If not available, use local code and manual commands. Do not require extra services solely to use a tool. Do not expose secrets or patient information to external tools.

The user handles routine terminal commands, dependency installation, Git commits and pushes manually unless explicitly requesting otherwise. Do not initialize a repository, install packages, migrate databases or create commits/pushes without permission. No mobile emulators. No destructive commands, force pushes, or modifications outside the project directory.

## Engineering rules

- React + Vite, Node.js + Express, PostgreSQL via `pg`, JavaScript and plain CSS. Prefer built-in features and small dependencies. No MongoDB, ORM, Redux or TypeScript additions without approval.
- Keep routes and functions focused. Use clear names and comments for non-obvious business rules. Do not add empty layers, speculative abstractions or fake functionality.
- Validate all untrusted input on the server. Frontend validation improves UX but is never security. Use official messages, exact slot labels and the approved error precedence. Preserve date-only values and use the documented calendar timezone. Compute reports using the selected date and correct calendar boundaries.
- bcrypt password hashing, JWT verification, secure cookie policy, CSRF origin protection, parameterized SQL, least privilege, per-user ownership on every reading/report query and safe errors. Never store plaintext passwords, commit secrets, expose hashes/tokens or log sensitive payloads.
- PostgreSQL constraints are mandatory for uniqueness, valid slots and glucose range. Handle database conflicts safely. Do not trust request-body user IDs. Do not let test/seed scripts damage unrelated data.
- Use a dedicated test database and real HTTP integration tests. Check success, failure, bounds, ownership, report calculations and date edges. No tests that merely assert mocked behavior for core SQL rules. Do not remove tests to make a build pass.
- Follow `design.md` and include loading, error, empty and responsive states. Do not generate medical advice or use real patient data.
- Keep `.env.example` and README aligned with actual configuration. Avoid hard-coded secrets. Keep package lockfiles and meaningful incremental Git history.

## Module completion gate

1. Approved acceptance criteria met.
2. Relevant tests and checks actually run and passed, or explicitly listed as pending (module remains incomplete).
3. Security and validation reviewed; no known critical defects.
4. User understands the important logic and can explain it.
5. User reviews diff and makes an honest incremental commit.

## Current module: 00 — Planning only

Review the four planning documents for contradictions with the assignment. Do not generate application source, install dependencies, start servers, create databases, or run migrations. Report any actual conflicts, missing details, and readiness for Module 01. No code changes are authorized until the user explicitly begins Module 01.
