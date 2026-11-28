# Market module retirement

The financial Market module (`apps.market`, `/markets`, `/api/v1/market/`) has been
permanently removed from Karfansa. Unrelated product-marketplace wording
(«بازار محصولات») and trade `target_market` fields remain.

## What was removed

- Django app `backend/apps/market/` (models, admin, API, Celery tasks, providers)
- Public API routes under `/api/v1/market/`
- Public frontend `/markets` page, homepage Markets strip, header/drawer quotes
- Control Center Market resources and health `market_sync` component
- Celery Beat schedule `refresh-market-data-every-minute`
- Environment variables `MARKET_*`

## Database cleanup strategy

1. **Backup first** (local example):

   ```bash
   docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > backup-before-market-retirement.dump
   ```

2. **Preferred path (already applied in development):** while `apps.market`
   still existed, migration `market.0005_remove_market_models` deleted
   `MarketPrice`, `MarketIndicator`, and `MarketDataProvider` and cleaned their
   content types / permissions.

3. **Safety net for codebases that no longer ship `apps.market`:**
   `management.0003_cleanup_retired_market_app` runs
   `DROP TABLE IF EXISTS … CASCADE` for Market tables and deletes orphaned
   `django_migrations` / content-type rows for `app_label=market`.

4. Fresh installations never create Market tables.

Do **not** reset the database or delete Docker volumes. Do **not** run
destructive SQL against production without an approved backup and restore drill.

## Apply locally

```bash
docker compose up -d --build
docker compose exec backend python manage.py migrate --noinput
docker compose exec backend python manage.py check
docker compose restart worker beat
```

Optional Redis key cleanup (targeted; never `FLUSHALL`):

```bash
docker compose exec redis redis-cli --scan --pattern '*market*' | head
# Review matches, then delete only confirmed Market keys if any remain.
```

## Rollback

Restore the PostgreSQL dump taken before migration and redeploy the previous
application images/code that still contain `apps.market`. Market migrations
are no longer shipped; rollback is restore-from-backup, not reverse-migration.
