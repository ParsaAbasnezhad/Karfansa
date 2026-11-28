# Main-platform news retirement

The main platform no longer publishes or fetches news. The independent news site is
`https://karfansa.news.ir/`. This note records the data and URL decisions needed
before any later cleanup of production records.

## Retained data

- `apps.news` defines `NewsSource`, `NewsTopic`, and `News`. `News.source` points
  to `NewsSource` with `CASCADE`; `News.topic` points to `NewsTopic` with
  `SET_NULL`. These models and their historical migrations remain installed so
  existing rows stay accessible for an approved export or audit.
- `apps.organization_news` defines `OrganizationNews`, which points to
  `organizations.Organization` with `CASCADE`. Its model and migration also
  remain installed. Company registration and profiles do not need this app's
  views or publishing workflow.
- No other tracked application model has a foreign key to either news app.
  News image files and any stored source URLs must be included in a retention
  or export plan; removing UI routes does not delete them.

Do not remove either app from `INSTALLED_APPS`, delete migration history, or
generate/apply `DeleteModel` or table-drop migrations as part of this retirement.
Before any later deletion, take a verified database and media backup, inventory
row counts and references in the production database, export the records, agree
on a retention period and destination mapping, and seek explicit approval for
the destructive migration.

## Public URLs

The Django `/news` and `/news/` listings have permanent redirects to the independent news
homepage. Former company-news detail URLs under `/news/<organization>/<slug>/`
have no verified equivalent on the independent site, so they have no permanent
redirect. Add per-article redirects only after the destination URLs are confirmed.
If the production web server or CDN serves the React SPA before Django, add
equivalent `/news` and `/news/` redirects there. First inventory any public
`/archive/`, `/submit-news/`, and `/companies/news/` URLs; redirect them only
when a valid destination is known. This repository contains no production
web-server configuration or sitemap to edit.

## Background processing

The RSS Beat entry and its task implementation have been removed from source.
Restart Beat and workers when deploying so the persistent Beat schedule is
reconciled with settings. Verify
the running scheduler and worker queues after deployment; the checked-in
`backend/celerybeat-schedule` runtime file is not a source of truth and is not
altered by this change.
