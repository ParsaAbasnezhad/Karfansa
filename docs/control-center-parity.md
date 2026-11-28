# Django Admin parity inventory

**Status: migration in progress; Django Admin remains enabled.** This inventory
compares the registered Django Admin models and custom workflows with the
React Control Center's explicit `ResourceSpec` registry. A model appearing in
the registry does not mean feature parity: the generic table is not a
replacement for a custom form, inline, queryset action, or save hook.
Currently verified complete: **0 of 34 mandatory Control Center resources**.
The financial Market module has been permanently retired from the platform
(see `docs/market-retirement.md`) and is not part of Control Center inventory.
All listed entries remain partial; no cutover claim is made.

The comparison was made from `admin.site._registry`, each app's `admin.py`,
`backend/apps/management/resources/registry.py`,
`backend/apps/management/resources/services.py`, the management API, and the
React resource list/detail/form pages. Current generic behavior includes
permission-filtered lists, bounded pagination, field allowlists, model form
validation, individual record actions and an audit log. Frontend coverage
includes relationship selectors for registered related resources, allowlisted
many-to-many pickers and public-image uploads. Backend tests verify only a
small portion of this surface.

## Coverage matrix

| Registered model | Existing Django Admin capability | Current React/API capability | Missing parity / implementation status | Automated test status |
|---|---|---|---|---|
| `auth.Group` | Group records and permission assignment | Group list/create/edit/delete, model permission selection, and membership editing in Security; delegated scope and Super Administrator membership are checked server-side | Membership detail is capped at 500 and the full Django admin filtering/history UI is not reproduced; **partial** | Focused tests cover group creation, delegated permission scope, and Super Administrator membership protection |
| `accounts.User` | Custom add/change forms; group and permission editing; staff, superuser, active, group filters; email/name/phone search; province/city autocomplete; last login/date joined readonly | User list and administrator grant/revoke, individual action/object grants, group/role/session management; administrator grant provisions MFA enrollment and revocation clears permissions and sessions | Profile edit fields, admin list filters/autocomplete, and end-to-end account flows remain incomplete; **partial** | Focused tests cover administrator MFA enrollment response, grant revocation cleanup, and last Super Administrator protection; HTTP/MFA flow remains untested |
| `contact.ContactMessage` | Read-only message/contact data, read filter, date hierarchy, full-text search | Read toggle and details | `created_at` was removed from writable fields; no add/delete; needs exact admin filters/search and sensitive permission tests; **partial** | Public contact tests exist; console tests absent |
| `home.Slide` | Search, active filter, status/date list | Text/status CRUD and image upload after record exists | Upload-on-create and preview/validation parity; **partial** | Public slide tests exist; console tests absent |
| `home.AboutPageContent` | Custom fieldsets; singleton add policy; delete forbidden | Existing singleton fields editable, no create/delete | Fieldset UX and singleton invariant test; **partial** | Public-content tests exist; no console test |
| `intents.UserIntent` | Custom intent/person-type filters; follow-up editing; explicit lead-contact permission; custom statistics view; no add/delete | Follow-up/admin note detail and edit | Lead contact must use existing granular contact permission; custom filters/statistics view missing; **partial** | Intent tests cover public workflows, not management console |
| `analysis.AnalysisCategory` | Name/slug/order list; name/slug/description search | CRUD/delete; description included in search | Residual admin UX only; **partial** | Registry search fields updated |
| `analysis.AnalysisAuthor` | Full-name/position list and search | CRUD/delete; profile image upload on saved record | Upload-on-create and preview parity; **partial** | Public analysis tests only |
| `analysis.AnalysisReport` | List/search/filters; category/author autocomplete; readonly counters/timestamps; attachment inline | Curated report fields and scheduling/publication fields | Verify required admin form fields/actions; rich-text sanitizer and attachment inline/download/upload missing; **partial** | Existing public report tests only |
| `analysis.AnalysisAttachment` | File input; report search/filter/list; file metadata readonly | Metadata-only record; no file form | Upload/download and parent inline missing; **partial** | Existing file validation/download tests exercise public routes only |
| `advertising.Advertisement` | Organization autocomplete; status/source/date filters; search; readonly publication/timestamps | Moderation actions and curated fields; image upload on saved record | `created_via` filter/list, upload-on-create, delete policy parity; **partial** | Existing advertising tests cover service/public API; no console workflow test |
| `geography.Country` | Name/ISO list and search | CRUD/delete | Broadly aligned; validate admin filters/actions; **partial** | Management geography parity suite covers SA access |
| `geography.Province` | Country/capital autocomplete; publication filter; custom fieldsets; province-industry inline | Curated fields, relation selectors, inline industry panel, Playwright CRUD | Upload-on-create/preview still missing; **partial** | `test_geography_parity.py` + `e2e/province-city.parity.spec.ts` |
| `geography.ProvinceIndustry` | Custom form; province/industry autocomplete; active-city horizontal selector; activity/country filters | CRUD/delete, M2M active-cities, filters, parent inline | Custom form semantics residual; **partial** | Inline + filter assertions in geography parity suite |
| `geography.ProvinceStatistics` | Detailed list, filters and fieldsets; province autocomplete | Curated CRUD/delete and relationship selectors | Several admin list/filter fields and fieldset organization missing; **partial** | Public statistics tests only |
| `geography.City` | Province autocomplete; country display; county-center edit; province/country filters | CRUD/delete, province selector, computed `country_name`, nested country filter | List UX residual; **partial** | Geography parity suite + Playwright city flow |
| ~~`market.*`~~ | Retired | Removed from Control Center, public site, API, Celery | See `docs/market-retirement.md` | Retirement regression tests assert 404 / absent app |
| `organizations.Industry` | Slug prepopulation; horizontal product selection; category/publication filters | CRUD/delete; products many-to-many picker; image upload after save | Slug prepopulation, full filters and upload-on-create missing; **partial** | Public organization tests only |
| `organizations.Product` | Slug prepopulation; name/slug list/search | CRUD/delete | Slug prepopulation missing; **partial** | Public organization tests only |
| `organizations.Organization` | Rich filters/search; member selector and inline; readonly moderation state; approve/reject/suspend actions | Curated edits and moderation actions | Member inline missing; verify `staff_decide_organization` service parity; image upload-on-create missing; **partial** | Public business tests; moderation-specific console tests absent |
| `organizations.OrganizationMember` | Role/status/invitation list/filter/search; autocomplete; readonly timestamps | Curated update and relation selectors | No create; context/inline and exact filter coverage missing; **partial** | Public business tests only |
| `organizations.VerificationDocument` | Read-only fields; no add/delete; custom private download with explicit permission | Review actions, private-file API, download control | Verify every Django admin download permission and audit path; **partial** | Existing upload validation tests; private console download test absent |
| `organizations.BusinessAuditLog` | Read-only; add/change/delete forbidden | Read-only resource; sensitive view gate | Verify exact metadata display and permissions; **partial** | No console-specific test |
| `trade.TradeOpportunity` | Custom badges/list/search/filters; save hook re-queues changed approved items; moderation actions; permissioned delete | Curated edits; moderation and scheduling API; delete disabled | Scheduling form missing; compare exact save-hook fields and delete permission; **partial** | Existing trade public/business tests; console workflows untested |
| `services.SellerProfile` | Image previews; moderation actions; autocomplete; verification readonly | Curated edits and moderation; `is_public` editable; image upload after save | Verify `staff_decide_individual` service parity; upload-on-create/preview missing; **partial** | Public business tests only |
| `services.ServiceCategory` | Parent filter/autocomplete; slug prepopulation | CRUD/delete and relationship selector | Slug prepopulation and filters need parity; **partial** | Existing service public tests |
| `services.ProductListing` | Moderation actions; image/specification inlines; custom save/save-related hooks re-review and sync opportunities | Curated CRUD fields, moderation actions and public-image upload on an existing child | Inline UI and parent hooks on child edits missing; slug/admin delete parity differs; **partial** | Existing listing and upload tests cover public/business paths only |
| `services.ListingImage` | Listing search/autocomplete; image upload | Standalone metadata edit and image upload for an existing row | Cannot create a required-file image inline or parent workflow; **partial** | Existing upload tests cover user endpoint, not console |
| `services.ProductSpecification` | Listing autocomplete; create/edit/delete | Standalone CRUD/delete and relation picker | ProductListing inline and parent re-review/sync behavior missing; **partial** | Existing listing tests only |
| `services.ProductInquiry` | Inquiry list, status/quantity, status/date filters, contact search | Sensitive details and status editing | Sensitive-access permission and full admin search/filter coverage need validation; **partial** | Inquiry tests cover user-facing permissions, not console |
| `support.SupportTicket` | No add; staff reply form with attachments/internal note; readonly chronological messages; status actions and service-backed save hook | Assignment/priority fields, status actions, authorized conversation history, staff reply/internal note form, validated attachment upload and private attachment download; atomic bulk resource action/delete endpoint | Verify all list filters/actions; bulk path is not a substitute for every custom ModelAdmin action; **partial** | Focused management tests cover reply service and atomic bulk action; full HTTP/permission/MFA/upload flow untested |
| `support.TicketMessage` | Read-only message list/filter/search and attachment field | Read-only metadata as part of ticket thread; permission-checked private attachment download | Standalone message list filters and admin search parity missing; **partial** | Message behavior covered by support service tests and new management reply regression; download authorization untested |
| `transportation.TransportMode` | Name/code search and ordering | CRUD/delete | Broadly aligned; verify filters and ordering; **partial** | Transportation API tests only |
| `transportation.VehicleType` | Mode filter/autocomplete; slug in list/search | CRUD/delete and mode selector | Slug list/search parity; **partial** | Transportation API tests only |
| `transportation.TransportCompany` | Full company/service-area fields; relation autocompletes; filters; readonly timestamps | Curated fields, moderation, relation and many-to-many selectors | Match admin list/search/filters and image upload-on-create; test relationship saves and moderation; **partial** | Transportation API tests only |

## Cross-cutting gaps and cutover gate

- Django's ModelAdmin registration count is 37, including `auth.Group`; every
  listed resource has a registry entry, but not every registered admin
  operation is implemented in React.
- The generic form currently relies on Django `ModelForm` validation and safe
  writable-field allowlists. It does not derive all custom admin fieldsets,
  widgets, `save_model`, `save_related`, delete hooks, list filters, or inline
  classes. Each discovered custom workflow must be mapped and tested explicitly.
- The resource table now sends one atomic server-side bulk action/delete
  request (maximum 100 selected records); each object is authorization-checked
  and errors roll the transaction back. Existing per-resource actions are
  exposed where registered, but several Django ModelAdmin-only custom actions
  and their rejection-reason workflows still need parity mapping.
- Security now provides Django group management, model-permission assignment,
  membership editing, explicit administrator grant/revoke, individual action
  permissions, and object grants. Grant/revoke and group permission changes
  require reauthentication; delegated scope and last-Super-Administrator
  checks are enforced server-side. Group membership editing is limited to 500
  members; the API flags larger groups as truncated and rejects mutation to
  prevent the current bounded picker from silently removing memberships. This
  does not complete User/Group parity.
- The ModelAdmin inline configurations for analysis attachments, province
  industries, organization members, listing images, and product specifications
  are still not implemented as parent-detail inline workflows.
- Existing API support for file and private-file operations needs automated
  authorization, upload, create, preview, and download tests and frontend
  integration for every registered file field. The support-ticket thread and
  staff reply path are implemented; end-to-end authorization and attachment
  coverage remain outstanding.
- `django.contrib.admin` and the `/admin/` URL intentionally remain enabled.
  Do not disable them until every row is parity-verified, primary/delegated
  access and recovery are exercised, PostgreSQL deployment/rollback is tested,
  and explicit cutover approval is recorded.

## Verification state

The complete backend suite passed after the latest changes: **168 passed,
11 warnings** using `--ds=config.settings.test --reuse-db` in an isolated
one-off Compose container. The focused security/resource suite passed
(11 tests); the administration frontend production build and unit suite passed
(1 test); Docker Compose syntax and migration consistency passed. Django's
deployment check reports the existing HTTPS/HSTS warnings in test settings.
No browser-based workflow tests, production-like proxy tests, API performance
measurements, query-count measurements, or backup/restore/rollback exercises
have been completed. Keep explicit test settings when running backend tests;
the long-running development container can restart during autoreload and
interrupt `exec`-based test runs.
