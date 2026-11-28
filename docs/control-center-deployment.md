# Karfansa Control Center deployment and recovery

The management UI is a separate Vite application in `admin-frontend/`. Its
bundle is served only on `console.karfansa.ir` and is not included in the public
site bundle. Django serves its authenticated API under
`/api/v1/management/`. PostgreSQL holds users, grants, sessions and audit
events; Redis supplies login throttling, safe aggregate caches and Celery
health counters. No administrative secret belongs in a Vite environment
variable or a browser storage API.

## Local development

1. Create a local `.env` with `scripts/setup.ps1` if one does not exist. This
   generates new development secrets. Never run the script with `-Force`
   against an existing database because that changes its configured password.
2. Start the existing Compose project with `docker compose up --build -d`.
   The public site is on `http://localhost:5173`, the console on
   `http://localhost:5174`, and Django on `http://localhost:8000`. Vite proxies
   `/api/` to Django on the same browser origin. Neither frontend development
   server is intended for public exposure.
3. Run `docker compose exec backend python manage.py migrate` without resetting
   the database. Existing application tables and records are preserved.
4. Bootstrap an existing trusted Django superuser using
   `docker compose exec backend python manage.py bootstrap_management_admin --email <address>`.
   The command provisions the isolated management profile for password-only
   authentication, clears any prior TOTP/recovery material, and seeds default
   role templates. It does not change the administrator password. Administrator
   self-registration is unavailable.
5. Open the console and sign in with email and password only. MFA/TOTP is not
   part of Control Center login in development or production.

Run `scripts/check.ps1` for the full container quality gates, including the
independent console checks. The console can also be built alone with
`docker compose run --rm admin_frontend npm run build`.

## Production boundary

Use `config.settings.production` and a unique, long production
`DJANGO_SECRET_KEY`. Set `DJANGO_ALLOWED_HOSTS` to the actual public hosts and
`console.karfansa.ir`; set `MANAGEMENT_ALLOWED_HOSTS=console.karfansa.ir`.
Control Center authentication is always password-only; leftover
`MANAGEMENT_MFA_REQUIRED` environment values are ignored.
Set `DJANGO_CSRF_TRUSTED_ORIGINS` to exact HTTPS origins. Set
`MANAGEMENT_TRUSTED_PROXY_IPS` only to the immediate proxies allowed to supply
client IPs. Keep the database, Redis and Django ports private. Serve the
console and its API through one HTTPS origin so secure host-only cookies and
CSRF work without cross-origin credentials. The management session cookie is
scoped to `/api/v1/management/` and is separate from the public session.

Build `admin-frontend/Dockerfile` with target `build`; copy `/app/dist` from
that image to a versioned deployment directory. The example
`deploy/nginx/control-center.conf.example` serves those static files and
proxies only the management API to Django. Adjust its TLS certificate paths,
upstream and static root to the deployment. Forward the original `Host` and
trusted `X-Forwarded-Proto`, and reject other `/api/`, `/admin/`, `/media/` and
private-media paths on the console host. Keep HTML and management API responses
uncached; only hashed `/assets/` files get immutable cache headers. This origin
has no service worker. The public PWA service worker must never control the
console origin or cache its API responses.

Use TLS throughout the public edge. Configure the reverse proxy so the Django
production `SECURE_PROXY_SSL_HEADER` reflects traffic that actually arrived
over HTTPS. Limit CSP and `connect-src` to the console origin, deny framing,
and disable proxy/CDN caching on authenticated responses. Keep API docs disabled
in production. Do not expose Django's internal health data, environment
variables, storage paths, credentials, or task payloads through the console.

## Release, data integrity and rollback

Before each release, take a consistent PostgreSQL backup and a backup of
private media. For example, use `pg_dump -Fc` with a protected output path and
record the deployed image digests and migration state. Verify a restore into a
separate database. Run `python manage.py migrate --plan`, then apply only
reviewed, non-destructive migrations. Deploy the backend and independent
console bundle together, then check login, mandatory MFA, core resource
queries, moderation, private document access, audit records and direct-route
reloads on the console host.

If the release fails, switch the reverse proxy back to the previous versioned
console bundle and backend image. Do not blindly reverse migrations containing
new audit or business data. Restore a database backup only through the
organization's incident process after assessing records written since the
backup. Keep the prior deployment artifacts until the new release has passed
operational checks.

An authorized operator with host and database access can run
`python manage.py recover_management_admin --email <address>` through a secure
interactive shell. This is the emergency path if a super administrator loses
password access. Log the incident, verify operator identity out of band, rotate
affected credentials, revoke active management sessions and inspect the audit
trail. Never transmit passwords through process arguments, logs, tickets or chat.

## Django Admin cutover gate

The legacy `/admin/` route must remain available to the current authorized
operators until the console has passed all of these checks in a production-like
environment:

- Every currently registered Django Admin model has an equivalent management
  view or a documented, tested specialized workflow, including uploads and
  private-file handling.
- The primary super administrator can manage all supported modules; delegated
  administrators cannot exceed their grants, alter protected superusers, or
  disable the final active super administrator.
- Password and MFA enrollment, recovery codes, session revocation, CSRF,
  throttling and account recovery have been exercised.
- Moderation and publishing rules, audit immutability, backup/restore and a
  release rollback have been tested with PostgreSQL and the actual proxy.
- Existing project tests, management backend tests, console tests, TypeScript,
  lint, builds and browser checks pass, and production data integrity is
  verified without a reset.

Only after these checks pass should `/admin/` be removed from Django URL
registration. It must then return 404 and must not redirect to the console.
Retain the old `admin.py` files and dependencies for a reviewed rollback period;
the recovery CLI remains available. Do not deploy or change production routing
as part of a local development run.

## Operational checks

On the console origin, check that `/api/v1/management/auth/csrf` and the login
flow set secure cookies, every management API response has
`Cache-Control: private, no-store`, and an anonymous resource/dashboard/health
request is rejected. Check `Content-Security-Policy`, `X-Frame-Options` and
`X-Content-Type-Options` headers. Verify a deep console route returns its own
HTML and `/api/v1/management/` never returns that HTML. Confirm the public
site's PWA cache contains no console or management API data. Watch the health
page for database, Redis, worker, Beat and bounded task outcomes; unavailable
measurements must remain explicitly unavailable.

The audit table has a PostgreSQL trigger rejecting ordinary updates and
deletes. It is indexed by time, actor and target. Run
`python manage.py archive_management_audit --output <private-new-path>.jsonl`
to stream events older than the default 730 days into a private JSONL archive
and SHA-256 manifest. Store and verify both files with restricted access and a
database backup before any purge. A purge additionally requires `--purge`, an
interactive confirmation, and a separate `MANAGEMENT_AUDIT_ARCHIVER_DSN` for
the dedicated `karfansa_audit_archiver` PostgreSQL role. The DBA must create
that role with only the table permissions needed for archive deletion and must
never grant the application role membership in it. Keep this DSN outside the
web, worker and Beat environments. The command verifies the selected database
ID set before deleting. Do not add a console action that edits or deletes
audit events.
