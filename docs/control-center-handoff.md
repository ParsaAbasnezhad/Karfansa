# Karfansa Control Center — Agent Handoff

**Updated:** 2026-11-28  
**Status:** In progress — Phases 1–5 foundational work landed; Phase 6+ (parity / Playwright) remain.

## Architecture snapshot

- Backend: `backend/apps/management` (Django Ninja under `/api/v1/management/`)
- Admin UI: `admin-frontend/` on port `5174` (`console.karfansa.ir` in production)
- Public UI: `frontend/` on port `5173`
- Models present: `AdminProfile`, `AdminRole`, `AdminRoleAssignment`, `AdminObjectGrant`, `AdminSession`, `AdminAuditEvent`
- Compose services healthy: backend, frontend, admin_frontend, db, redis, worker, beat

## Inspection follow-up (reconciled)

Findings from [Inspect main frontend account](9fc42598-8228-4c81-87a6-90b1e799b31c) and [Inspect admin-frontend UI](699b4e9f-f45c-4ff5-a1d5-20cc74d93ad7) were addressed in-session:

| Finding | Status |
|---|---|
| No account Control Center button / no `/me` access flag / no `VITE_ADMIN_FRONTEND_URL` | **Fixed** |
| Admin LoginPage still multi-stage MFA UX | **Fixed** (password-only; unexpected MFA shows error) |
| Thin Playwright (province/city only); 0 verified parity cutover | **Still open** |
| Specialized workflows beyond tickets/private docs | **Still open** |
| Backend inspection agent | Blocked by provider; inspection done manually instead |

## Do not

- Change the operator’s existing Super Administrator password
- Reset DB / delete Docker volumes / destructive migrations without approval
- Disable Django Admin until full cutover gate passes
- Restore Markets page / Market application UI
- Store credentials or session tokens in localStorage/sessionStorage or URL params

## Progress log

- [x] Phase 1 inspection
- [x] Phase 2 password-only auth (settings forced false; MFA endpoints 404; login invalidates TOTP)
- [x] Phase 3 default role templates + duplicate role API (partial; further escalation tests TBD)
- [x] Phase 4 account page Control Center card + `control_center_access` on `/v1/auth/me`
- [x] Phase 5 Security/admin UI polish (role duplicate, reauth password-only, market nav hide, dashboard metrics)
- [ ] Phase 6 resource parity modules
- [ ] Phase 7 tests (backend/frontend/Playwright expansion)
- [ ] Phase 8 deployment docs + evidence

### Evidence notes (this session)

- Password-only: `backend/config/settings/{base,development,test,production}.py`, `api/auth.py`
- Access flag: `apps/management/access.py`, `accounts` ProfileOut/`/me`
- Account card: `frontend/src/features/account/AccountPage.tsx`, `lib/control-center.ts`
- Role templates: `apps/management/role_templates.py`, `seed_management_roles`, bootstrap seeds templates
- Duplicate role: `POST /security/roles/{id}/duplicate`
- Market module fully retired (see `docs/market-retirement.md` / `docs/market-removal-report.md`)
- Dashboard metrics expanded (tickets, sessions, failed logins, pending queues)
- Tests: management suite green after MFA grant-test rewrite; LoginPage + AccountPage unit tests green

### Remaining (highest priority)

1. Complete resource parity modules one-by-one with functional verification (start: support tickets, organizations moderation, geography)
2. Expand Playwright browser workflows against Compose (SA / Support / ordinary user)
3. Effective-permissions inspector UI polish + permission change preview
4. Performance query-count measurements
5. Keep Django Admin until cutover gate passes
6. Production: backup → migrate → recreate worker/beat after deploying Market removal

## Next agent entry points

1. `docs/control-center-parity.md` — inventory
2. `backend/apps/management/` — auth, permissions, security API, resources
3. `admin-frontend/src/` — LoginPage, SecurityPage, Dashboard
4. `frontend/src/features/account/AccountPage.tsx` — Control Center card
5. This handoff — update after each phase with evidence
