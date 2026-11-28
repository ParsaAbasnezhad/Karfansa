# PWA deployment

The `frontend/Dockerfile` build stage produces the Vite site in `/app/dist`.
That directory contains `index.html`, `/manifest.webmanifest`, `/sw.js`, the
offline document, and icons. The existing `docker-compose.yml` is for
development only; the production reverse proxy must serve the built directory
at the site root over HTTPS. Localhost is the only HTTP exception for PWA
testing. The service worker needs the URL `/sw.js` and scope `/`.

Django production settings expect TLS termination at the reverse proxy. Send
the original `Host` and `X-Forwarded-Proto: https` headers to Django so its
secure session and CSRF cookies continue to work. Use a single public origin
for the frontend and API, as the existing API client uses same-origin `/api/`
requests.

Configure the reverse proxy so `/api/` and `/admin/` reach Django, and
`/media/` reaches its authorized media handler, before applying the frontend
SPA fallback. Do not send those paths, `/private_media/`, private attachments, or Django static
files to `index.html` or `offline.html`. Public application routes should fall
back to `index.html` while online; known static asset paths should return 404
if missing rather than returning HTML. The service worker sends public
navigations to the network and shows `/offline.html` only when that navigation
fails. Sensitive routes are network only and never receive the offline page.

Serve `/sw.js` with `Cache-Control: no-cache` (or `no-store`) so browsers can
discover updates. Serve `/manifest.webmanifest` with
`Content-Type: application/manifest+json` and revalidation-friendly caching.
Hashed Vite assets under `/assets/` can use long-lived
`Cache-Control: public, max-age=31536000, immutable`; unhashed icons,
`/offline.html`, `/offline.css`, `/offline.js`, and `index.html` should be revalidated or
versioned when changed. Keep these rules at the reverse proxy and any CDN.
Workbox precaches `offline.html`, `offline.css`, `offline.js`, the favicon,
hashed JS/CSS/font bundles, and application icons. `index.html` stays network
only for navigations. The public hero image is excluded, and Workbox removes
obsolete precache revisions.

Do not cache API or private media responses in the proxy/CDN. The app image at
`frontend/src/assets/app/app-image.png` is a 1254×1254 JPEG despite its `.png`
extension; it is preserved as supplied. The optimized PNG icon derivatives are
published at stable `/icons/` URLs from `frontend/public/icons/`. The maskable
icon pads the complete mark and wordmark within the central safe zone.

The application requests confirmation before activating a waiting service
worker. The update notification remains visible until the user selects
«به‌روزرسانی»; the proxy must not force automatic page reloads.

After deployment, inspect the response headers for `/sw.js`,
`/manifest.webmanifest`, `/assets/<hashed-file>`, and `/icons/icon-192.png`.
Verify that a direct public route loads the SPA, while `/api/`, `/admin/`, and
`/media/` never return the SPA shell. In browser developer tools, confirm the
manifest has no icon errors, `/sw.js` controls the page after reload, offline
navigation shows the Persian offline document, and private API requests are
not stored in Cache Storage.
