# Setup and local operation

## Requirements

- Git and Node.js 24; the frontend requires Node.js 22.12 or newer.
- Internet access for installing locked npm dependencies, including the SheetJS package.
- Windows PowerShell, or a terminal on macOS/Linux.
- No standalone database installation for embedded local mode.

Use the repository root containing `package.json`, `frontend/` and `backend/`. A GitHub clone puts these directly inside `PA-TA-Hackathon/`; an extracted local copy may put them inside `pa-ta-portal/`.

## Fresh checkout

```powershell
git clone https://github.com/BalaVigneshKannan/PA-TA-Hackathon.git
cd PA-TA-Hackathon
npm.cmd ci
node backend/src/setup-local.js
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run seed:courses -w backend
npm.cmd run build
npm.cmd run preview
```

Use `npm` instead of `npm.cmd` on macOS/Linux. [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/) installs the dependencies specified by the lockfile without updating it.

Open [http://127.0.0.1:5173/login](http://127.0.0.1:5173/login). Keep the terminal running; Ctrl+C stops the preview. Use `127.0.0.1` consistently: mutations from a different origin such as `http://localhost:5173` are intentionally rejected.

`setup-local.js` creates `backend/.env` with a random session secret and random seed passwords, then writes credentials to `LOCAL-ACCESS.md`. It does not overwrite an existing `.env`. The seed command creates missing accounts without changing existing passwords. Configurations, credentials, dependencies, builds and local databases are excluded from Git.

The initial student account has a synthetic academic profile. Faculty login requires a matching course-head assignment in the active semester. A fresh database has no configured semester or opportunities. The sample core master is for demonstrating uploads, not an approved university curriculum.

## Configure the first application cycle

1. Sign in as Admin using the generated credentials in `LOCAL-ACCESS.md`.
2. Create a Fall or Spring semester with application dates in Dubai time. Leave it as a draft while configuring it if desired.
3. Upload a workbook containing `Course Code`, `Course Name`, `Course Head`, and `Faculty Email`. Preview its results and confirm the core-course matches.
4. Set PA/TA slots, semester amounts and application dates in Allocations.
5. In the same page, select each course and publish PA/TA eligibility requirements.
6. Activate the semester. Students see the generated opportunities; applications are enabled only inside the application window when eligibility is met.
7. Faculty reviews candidates, accepts appointments and submits selections to Admin. Admin approves the final list.

Sample workbooks are in [`frontend/public/samples/`](../frontend/public/samples/). Duplicate courses, duplicate core-course heads, invalid campus emails and formula cells prevent confirmation. Non-core courses are ignored. Each faculty head can head one core course per semester. A second upload cannot replace already confirmed assignments in the current implementation.

## Optional demo data

With the preview stopped:

```powershell
npm.cmd run seed:demo -w backend
```

This creates missing synthetic student/faculty accounts and the six-core-course demo workbook. Newly generated passwords are written to `DEMO-ACCESS.md`; existing passwords remain unchanged. Upload `frontend/public/samples/hackathon-course-heads.xlsx` to a new semester to match the demo faculty accounts. Running the demo seeder again after assignments exist fills missing sample rules and zero allocations for those demo courses. Follow [DEMO-GUIDE.md](../DEMO-GUIDE.md) for the review and approval walkthrough.

To load sample class timetables for an active semester, stop the preview and run `node src/seed-timetable.js` from `backend/`. Timetables are synthetic and do not implement assistantship duty-overlap detection.

## Development and verification

```powershell
npm.cmd run dev
```

The development launcher runs the API on `127.0.0.1:3001` and Vite on `127.0.0.1:5173`; Vite forwards `/api` requests to the API. Frontend edits reload automatically. Restart the launcher after backend changes. The compiled preview serves both through port 5173 and requires a new build after frontend edits.

```powershell
npm.cmd test
npm.cmd run build
```

The 58 backend integration tests use isolated databases and temporary test directories; they do not change the packaged demo database. The build emits existing non-blocking React Router `use client` warnings.

## Existing local copy

Stop any running embedded preview before accessing its database from another process:

```powershell
npm.cmd run db:migrate
npm.cmd run build
npm.cmd run preview
```

No reseed is required. Eight numbered migrations apply only when their version is absent from `schema_migrations`. Startup restores supporting empty PostgreSQL directories omitted by archives, including `pg_notify`; it does not replace data files or recreate missing core database directories.

## Environment settings

Copy [`backend/.env.example`](../backend/.env.example) if configuring manually. Edit it before starting the server.

| Variable | Purpose |
|---|---|
| `DATABASE_MODE` | `embedded` for local single-process storage, `postgres` for an external PostgreSQL service. |
| `DATABASE_URL` | PostgreSQL connection string when embedded mode is not selected. |
| `JWT_SECRET` | Required session signing secret, at least 32 characters; the example value is rejected. |
| `PORT` | API port, normally 3001. The compiled preview explicitly overrides it to 5173. |
| `APP_ORIGIN` | Exact allowed browser origin; local default `http://127.0.0.1:5173`. |
| `NODE_ENV` | `production` enables secure cookies and serves the built frontend. |
| `SERVE_FRONTEND` | `true` serves the built frontend outside production; the preview sets it automatically. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Required for the initial Admin seed. Password: at least 12 characters, at most 72 UTF-8 bytes. |
| `SEED_FACULTY_PASSWORD`, `SEED_STUDENT_PASSWORD` | Optional local role-account passwords. |
| `UNIVERSITY_DOMAIN` | Allowed authentication email domain; default `dubai.bits-pilani.ac.in`. Workbook validation currently uses that campus domain directly. |
| `INTRANET_ISSUER`, `INTRANET_AUDIENCE`, `INTRANET_PUBLIC_KEY` | Optional university assertion settings; configure all three together. See [intranet-integration.md](intranet-integration.md). |

For a PostgreSQL server, create a database, set `DATABASE_MODE=postgres` and its `DATABASE_URL`, then run migration/seed commands. No migration from an existing embedded demo into a PostgreSQL service is automated. See [deployment.md](deployment.md) for hosting and backup instructions.

## Troubleshooting

| Symptom | Resolution |
|---|---|
| `Cannot find package ...` | Run `npm.cmd ci` in the repository root. |
| Invalid or missing session secret | Generate configuration with `setup-local.js`, or replace `JWT_SECRET` manually. Never overwrite existing credentials to fix an unrelated error. |
| Migration fails with PGlite `Aborted()` | Stop other embedded database processes and use the updated startup code that restores omitted supporting directories. Preserve a backup before investigating missing or corrupted data files. |
| `EADDRINUSE` / port 5173 unavailable | Stop the existing preview or Vite process. Do not run preview and dev together. |
| Login returns 403 for Faculty | Activate a semester and confirm a matching core-course assignment for that exact faculty email. |
| Opportunities are empty | Check the active semester, nonzero allocations and published eligibility rules. |
| Apply is disabled | Review eligibility reasons, application dates, duplicate applications and existing same-role appointments. |
| Request origin is not allowed | Use the exact hostname and scheme in `APP_ORIGIN`. |
| Final approval is blocked | Faculty must submit every active appointment, and allocation/appointment conflicts must be resolved. |
| Windows blocks Vite's development loader | Use `npm.cmd run build` followed by `npm.cmd run preview`. |

The application has no password-reset UI or account-creation UI. Keep generated credentials private and available. The seed command does not rotate existing account passwords.
