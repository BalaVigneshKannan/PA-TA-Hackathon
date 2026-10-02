# PA / TA Application Portal - Complete prototype (Phases 1-20)

React, Express and PostgreSQL portal with college intranet branding. Includes semester/Excel setup, dynamic faculty authorization, allocations, eligibility, multiple applications, interviews, appointment conflicts and cancellation, vacancies, final approval, Excel/PDF results and audit history.

Start with the [demo guide](DEMO-GUIDE.md), [remaining phase details](docs/phases-6-20.md), and [Phase 3 sample upload instructions](docs/phase-3.md).

The latest [problem-statement comparison](docs/problem-statement-review.md) records workflow fixes and unused-code cleanup. The optional [university intranet interface](docs/intranet-integration.md) supports signed university identities and authoritative academic snapshots; live university configuration is still required.

## Requirements

Node.js 22.12+ (tested with Node 24). Use either a PostgreSQL server or the included local PGlite embedded PostgreSQL runtime. Embedded mode is for single-process local development; it runs the same SQL migration and persists data under `backend/.data/`.

## Run locally

For automatic local setup with random credentials, run `node backend/src/setup-local.js` after installing dependencies. It creates `backend/.env` without overwriting an existing file, and saves the three generated accounts in the Git-ignored `LOCAL-ACCESS.md`. Then run the migration, seed, and dev commands below. Use the manual instructions below if you prefer to choose your credentials or use a PostgreSQL server.

Open a terminal in this project directory:

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env`: set a random `JWT_SECRET` of at least 32 characters and a `SEED_ADMIN_PASSWORD` of at least 12 characters (at most 72 UTF-8 bytes). Generate a secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

For the simplest local setup, leave `DATABASE_MODE=embedded`. To use a PostgreSQL server instead, create an empty database, set `DATABASE_MODE=postgres`, and provide its `DATABASE_URL`. Both modes use the same schema and queries.

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Open http://127.0.0.1:5173 and select **Admin**. Use `SEED_ADMIN_EMAIL` and the password you configured. The seed command never resets existing passwords. Optional `SEED_FACULTY_PASSWORD` and `SEED_STUDENT_PASSWORD` create `faculty@dubai.bits-pilani.ac.in` and `f20240123@dubai.bits-pilani.ac.in` for role testing. Leave them blank if not needed.

Keep the `127.0.0.1` hostname consistent with `APP_ORIGIN`; origin checks deliberately reject other hostnames. Stop the server before running migrations or seeds in embedded mode, because the database belongs to one process at a time.

Packaged copies may omit empty PostgreSQL directories. Embedded startup restores required supporting directories automatically when the database already exists; it preserves existing records. It does not recreate missing core database directories or files. A backup of the repaired packaged database is retained in `backend/.data-backup-before-startup-repair/`.

### Compiled local preview

If a restricted Windows environment blocks Vite's development dependency loader, use the compiled app instead:

```powershell
npm.cmd run build
npm.cmd run preview
```

This serves the real frontend and API together at http://127.0.0.1:5173 with the persistent local database. Stop any existing dev server first. Rebuild after frontend changes. This preview uses your development configuration; it is not a public deployment. The dev launcher reloads frontend edits; restart it after backend edits.

## Verify the complete portal

Run `npm.cmd test` and `npm.cmd run build`. The integration suite uses an isolated in-memory database and does not modify the local demonstration data. Follow [DEMO-GUIDE.md](DEMO-GUIDE.md) for a complete role-by-role rehearsal.

## Structure

- `frontend/src/`: campus shell, semester/upload/allocation pages, student workspace, faculty review and Admin control centre.
- `backend/src/`: authentication, semester configuration, Excel processing, eligibility, application/appointment transactions, reports and exports.
- `database/`: eight additive versioned migrations, including preserved final results and institutional identity support.
- `backend/test/`: authentication, semester, Excel, faculty, allocation and full workflow integration tests.
- `docs/`: phase notes and prototype limitations.

## Production configuration

Use a real PostgreSQL service, a unique strong secret, `NODE_ENV=production`, and an HTTPS `APP_ORIGIN`. Build the frontend, migrate and seed the database, then run `npm.cmd start`. Express serves the built frontend. The API binds to loopback; place a trusted HTTPS reverse proxy in front of it. Secure cookies require HTTPS. Configure proxy trust and shared rate-limit storage for your actual deployment before scaling to multiple instances. Never commit `.env` or the embedded database.
