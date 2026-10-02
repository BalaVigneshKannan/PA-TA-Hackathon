# Deployment instructions

## Supported example and verification scope

This runbook describes a single Linux host running Node.js, an external PostgreSQL database, and Nginx terminating HTTPS. The repository includes [a systemd service example](../deploy/pa-ta-portal.service.example) and [an Nginx configuration example](../deploy/nginx.conf.example). Replace their paths/domain/certificate settings for the actual host. These are configuration templates, not a completed public deployment.

The verified environment is Windows with Node.js 24, local embedded PGlite, 58 passing backend tests and a successful frontend build. Standalone PostgreSQL, Linux service installation, TLS and the university connection have not been exercised in this session. Deploy to a staging environment and verify the workflow before university use.

The current API listens only on `127.0.0.1`. This example places Nginx on the same host. Containers or managed hosts requiring a `0.0.0.0` listener need an intentional server binding change; no configurable `HOST` setting currently exists. A static-only host cannot run the Express API, database or selection workflow.

## 1. Prepare the host

Provide Node.js 24, Git, npm, PostgreSQL and Nginx using your host's supported installation method. Create a dedicated `portal` service user and a checkout at `/srv/pa-ta-portal` accessible to that user:

```sh
git clone https://github.com/BalaVigneshKannan/PA-TA-Hackathon.git /srv/pa-ta-portal
cd /srv/pa-ta-portal
npm ci --include=dev
npm test
npm run build
```

Run installation/build commands with the deployment account's appropriate filesystem permissions. The compiled frontend is generated at `frontend/dist`; it is intentionally not committed. Build before starting the production API. [`npm ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci/) uses the committed dependency lockfile.

## 2. Provision PostgreSQL

Create a database and account with ownership of the application schema. For a PostgreSQL installation managed by the host administrator, the equivalent interactive `psql` steps are:

```sql
CREATE ROLE portal LOGIN;
\password portal
CREATE DATABASE pa_ta_portal OWNER portal;
```

Use a unique password. For a managed database, use its supplied connection settings, network rules and verified TLS configuration. The local connection-string example below is for PostgreSQL on the same host. The application does not automatically move records from an embedded database to an external service.

## 3. Configure the application

Copy `backend/.env.example` to `backend/.env` only for a new deployment; do not overwrite an existing configuration. Set real values before running migrations or the server:

```dotenv
DATABASE_MODE=postgres
DATABASE_URL=postgresql://portal:REPLACE_WITH_URL_ENCODED_PASSWORD@127.0.0.1:5432/pa_ta_portal
JWT_SECRET=REPLACE_WITH_A_UNIQUE_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
PORT=3001
APP_ORIGIN=https://portal.example.edu
NODE_ENV=production
UNIVERSITY_DOMAIN=dubai.bits-pilani.ac.in
SEED_ADMIN_EMAIL=admin@dubai.bits-pilani.ac.in
SEED_ADMIN_PASSWORD=REPLACE_WITH_A_UNIQUE_INITIAL_ADMIN_PASSWORD
SEED_FACULTY_PASSWORD=
SEED_STUDENT_PASSWORD=
INTRANET_ISSUER=
INTRANET_AUDIENCE=
INTRANET_PUBLIC_KEY=
```

Placeholder passwords and keys above are not usable deployment credentials. Generate the session secret locally, for example:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use a seed password of at least 12 characters and at most 72 UTF-8 bytes. Restrict `backend/.env` to the service account (for example, owner `portal`, mode `600`). Do not commit it or generated access files. After initial provisioning, seed password variables can be removed from the running service configuration; seeding does not reset an existing account's password.

`APP_ORIGIN` must exactly match the browser's public HTTPS scheme, hostname and port. Express sets Secure session cookies when `NODE_ENV=production` and serves the built React app automatically. `npm run preview` overrides the port and origin for local development; use `npm start` or the service below for deployment.

## 4. Migrate and provision the Admin

From the repository root, with the same configuration accessible to the deployment account:

```sh
npm run db:migrate
npm run db:seed
```

Migration versions are tracked in `schema_migrations`. The seed creates missing accounts and preserves existing passwords. Leave faculty/student seed passwords blank for an institutional deployment. The sample-course and demo seed commands are presentation tools; the real approved course master and academic records must be supplied by the university.

The portal has no account-creation UI. Local staff accounts require controlled provisioning; the optional intranet interface can provision verified students and assigned faculty but will not automatically create new Admin accounts. See [intranet-integration.md](intranet-integration.md) for the connection contract.

## 5. Start the API as a service

First confirm that `/usr/bin/node` in the example matches the installed Node executable, the `portal` user exists, and `/srv/pa-ta-portal/backend/.env` is readable by that user. Install the supplied unit:

```sh
sudo install -m 644 deploy/pa-ta-portal.service.example /etc/systemd/system/pa-ta-portal.service
sudo systemctl daemon-reload
sudo systemctl enable --now pa-ta-portal
sudo systemctl status pa-ta-portal
curl http://127.0.0.1:3001/api/health
```

Expected API health: `{"status":"OK"}`. The unit's working directory is `backend/`, so the existing dotenv loader reads `backend/.env`. It serves static files from `frontend/dist` and listens on loopback. Review service logs with `sudo journalctl -u pa-ta-portal -n 100 --no-pager`. The example uses systemd's documented [service lifecycle settings](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html) and [working-directory/process isolation settings](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html).

## 6. Configure HTTPS

Set DNS to the deployment host and obtain a valid certificate for the chosen hostname through your institution's certificate process. In `deploy/nginx.conf.example`, replace `portal.example.edu` and both certificate paths. Install it into the host's Nginx configuration include directory (often `/etc/nginx/conf.d/`):

```sh
sudo install -m 644 deploy/nginx.conf.example /etc/nginx/conf.d/pa-ta-portal.conf
sudo nginx -t
sudo systemctl reload nginx
curl https://portal.example.edu/api/health
```

Nginx forwards the application paths to the loopback API using its [proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html); certificate directives are described in its [SSL module](https://nginx.org/en/docs/http/ngx_http_ssl_module.html). The example permits multipart overhead above the API's 2 MiB workbook limit and leaves the browser's `Origin` intact. Do not expose the loopback API directly as an HTTP production endpoint.

The application currently does not configure Express proxy trust and uses in-memory rate-limit stores. The example therefore strips forwarded client-IP headers instead of claiming they are supported. With this unmodified single-instance configuration, browser logins share the proxy's rate-limit key. Before multiuser production service or multiple replicas, configure explicit trusted-proxy handling and appropriate per-client/shared rate-limit storage in the application, verify it against the real proxy chain, and update the template to forward client IPs. Do not simply enable unrestricted proxy trust.

## 7. Verify the deployed workflow

Confirm HTTPS page and API health, sign in as the provisioned Admin, and exercise a staging semester from draft through final export. Check wrong-role/course access, student eligibility, duplicate submission, simultaneous selections, slot limits, same-role cancellation, faculty submission and immutable final results. Confirm that refresh restores the session and logout revokes it. Verify a backup restore before loading real academic records.

Operational configuration also requires the university's course list, grade/year policies, signing key, account-role mapping and authoritative academic data. These inputs are not supplied by the repository. PDF Unicode limitations and the absence of password-reset/account-management UIs remain documented in [technical-overview.md](technical-overview.md).

## Updates, backup and recovery

Deploy a specific reviewed commit. For an update, back up PostgreSQL and the external configuration, stop the service, pull the approved revision, install dependencies, test, build, migrate, and start the service:

```sh
sudo systemctl stop pa-ta-portal
git pull --ff-only origin main
npm ci --include=dev
npm test
npm run build
npm run db:migrate
sudo systemctl start pa-ta-portal
curl http://127.0.0.1:3001/api/health
```

Run repository commands as the deployment account. A failed migration/build should be investigated before restarting the upgraded service. Old application code may not be compatible with newer schemas; rollback may require the matching database backup. Finalization and archival are application workflows, not backup mechanisms.

For same-host PostgreSQL, create a backup outside the repository and use its documented [custom-format dump](https://www.postgresql.org/docs/17/app-pgdump.html):

```sh
pg_dump -h 127.0.0.1 -U portal -W -Fc -f /srv/portal-backups/pa-ta-portal.dump pa_ta_portal
```

Create and secure the backup directory beforehand. Verify recovery into a separate empty database with `pg_restore` before relying on a backup; follow the installed PostgreSQL version's [restore documentation](https://www.postgresql.org/docs/17/app-pgrestore.html). Preserve approved results, audit data, institutional identities and configuration/signing-key continuity. Changing `JWT_SECRET` invalidates existing signed sessions.

For local embedded mode, stop the preview and copy the entire `backend/.data` tree, including empty directories. Never run two processes against the same embedded database. Keep `.env`, credential files and data backups out of published repositories. The local startup repair backup is not a general production backup strategy.
