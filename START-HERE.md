# Run the PA / TA portal locally

This repository includes both the React frontend and Express backend, PostgreSQL migrations, sample Excel workbooks, documentation and screenshots. Dependencies, compiled assets, local configuration, generated credentials and the demo database are excluded from Git.

Install Node.js 24, then open PowerShell in the repository folder. For a fresh clone:

```powershell
npm.cmd ci
node backend/src/setup-local.js
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run seed:courses -w backend
npm.cmd run build
npm.cmd run preview
```

Open http://127.0.0.1:5173/login. The preview serves the frontend and backend together. Keep the terminal running and press Ctrl+C to stop it. On macOS/Linux, use npm instead of npm.cmd.

setup-local.js generates backend/.env and LOCAL-ACCESS.md with random local credentials; existing configuration is preserved. Sign in as Admin using LOCAL-ACCESS.md, create and activate a semester, upload course heads, configure allocations and publish eligibility rules. Faculty access requires a matching course assignment. For additional synthetic demo students/faculty, run npm.cmd run seed:demo -w backend with the preview stopped and follow [DEMO-GUIDE.md](DEMO-GUIDE.md).

For an already configured local copy, stop the embedded preview, run npm.cmd run db:migrate, then npm.cmd run preview. Migrations preserve records; no reseed is needed. Do not overwrite your existing backend/.env or credential files. Empty PostgreSQL directories omitted by an archive are restored automatically during embedded startup.

After frontend edits, run npm.cmd run build and restart the preview. Run npm.cmd test for the isolated integration suite. The latest 58 tests pass; tests do not change the local demo database.

The workflow includes separate PA/TA forms, automatic eligibility checks, multiple applications, faculty review/interviews, selection and capacity checks, Admin approval, final exports and preserved history. See [docs/problem-statement-review.md](docs/problem-statement-review.md) for the requirement comparison.

College SSO/API integration is not configured. The optional signed-assertion interface and academic synchronization contract are documented in [docs/intranet-integration.md](docs/intranet-integration.md). Existing demo profiles and timetables remain synthetic until connected. Duty timetable overlap detection is not implemented.

npm ci restores dependencies from package-lock.json; installation requires internet access. The live university connection remains unconfigured until the institution supplies its authentication and academic-data settings.

For complete instructions, see the [setup guide](docs/setup.md), [technical overview](docs/technical-overview.md), [API reference](docs/api-reference.md), and [deployment guide](docs/deployment.md). The [README](README.md) indexes all submission documentation.
