# Market module removal — implementation report

**Date:** 2026-11-28  
**Status:** Complete on local Compose stack

## Deleted directories / files

- `backend/apps/market/` (entire Django app)
- `backend/tests/market/`
- `frontend/src/features/markets/`
- `frontend/src/features/home/MarketsStrip.tsx`
- `frontend/src/lib/market-api.ts`
- `docs/market-data.md` (replaced by `docs/market-retirement.md`)

## Modified (high-signal)

**Backend**
- `backend/config/settings/base.py` — removed `apps.market`, Beat schedule
- `backend/config/api.py` — removed `/market` router
- `backend/apps/management/api/health.py` + `schemas/health.py` — removed `market_sync`
- `backend/apps/management/migrations/0003_cleanup_retired_market_app.py` — safety-net DROP + metadata cleanup
- `backend/tests/test_news_retirement.py` — retirement assertions
- `backend/apps/management/tests/test_resources.py` — registry absence assertions

**Frontend**
- `frontend/src/app/App.tsx` — removed `/markets` route
- `frontend/src/lib/site.ts` — removed nav item / URL
- `frontend/src/features/home/{HomePage,data}.tsx|ts`
- `frontend/src/components/layout/{SiteHeader,MobileDrawer}.tsx`
- `frontend/src/lib/{types,mock-data,mock-api,api-client.test}.ts`
- Related unit tests

**Admin frontend**
- `admin-frontend/src/pages/HealthPage.tsx`
- `admin-frontend/src/api/types.ts`
- `admin-frontend/vite.config.ts` — exclude Playwright e2e from Vitest

**Docs / env**
- `docs/market-retirement.md`, `docs/market-removal-report.md`
- Updated parity / deployment / news-retirement docs
- `.env.example` (and local `.env`) without `MARKET_*`

## Removed API endpoints

- `GET /api/v1/market/overview/`
- `GET /api/v1/market/quotes/`
- `GET /api/v1/market/history/`

Verified locally → **404**. Public `/api/v1/health/` → **200**.

## Removed frontend routes

- `/markets` (SPA route + nav + homepage strip + header/drawer quotes)

`/markets` now falls through to existing 404 handling.

## Database strategy

1. Applied `market.0005_remove_market_models` while the app still existed (deleted models + content types).
2. Removed the app from `INSTALLED_APPS` and deleted its code.
3. Applied `management.0003_cleanup_retired_market_app` (`DROP TABLE IF EXISTS …`, purge `django_migrations` / content types for `market`).

Verified on local Postgres:

- `pg_tables LIKE 'market_%'` → **0 rows**
- `django_migrations WHERE app='market'` → **0 rows**

Volumes were **not** deleted. Database was **not** reset.

## Celery

- Removed `refresh-market-data-every-minute` / `apps.market.refresh_quotes`
- Recreated `worker` + `beat` containers so the schedule reloads

## Control Center

- Market resources already absent from `RESOURCES`
- Health UI no longer shows «همگام‌سازی بازار»

## Preserved (intentionally)

- Trade `target_market` and related UI copy
- «بازار محصولات» (services marketplace)
- Analysis labels such as «گزارش بازار»
- Unrelated marketing / marketplace wording

## Test / build results

| Check | Result |
|---|---|
| Django `check` | OK |
| `makemigrations --check --dry-run` | No changes |
| Backend pytest | **189 passed** |
| Frontend focused Vitest | **21 passed** |
| Frontend `typecheck` + `build` | OK |
| Admin `typecheck` + `build` | OK |
| Admin Vitest | **7 passed** |
| Compose services | healthy |
| Market API | 404 |
| Market tables | gone |

## Manual actions for other environments

1. Take a PostgreSQL backup before migrate.
2. Deploy this code.
3. Run `python manage.py migrate`.
4. Restart Celery worker + beat.
5. Optionally scan Redis for leftover `*market*` keys and delete only confirmed orphans (never `FLUSHALL`).
6. Remove any leftover `MARKET_*` secrets from production env stores.

## Exact Compose commands (local)

```powershell
docker compose up -d --build
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py check
docker compose up -d --force-recreate worker beat
docker compose exec backend python -m pytest -q --ds=config.settings.test --reuse-db
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run build
docker compose exec admin_frontend npm run typecheck
docker compose exec admin_frontend npm run build
docker compose exec admin_frontend npm test -- --run
```

See also: `docs/market-retirement.md`.
