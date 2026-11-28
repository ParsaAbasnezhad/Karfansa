export const sensitiveRequestMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

// Workbox serializes route matchers into the generated service worker. Keep
// these functions self-contained; imported constants would be undefined there.
export function isSensitiveRequest({ url }: { url: URL }) {
  return ['/api', '/admin', '/media', '/private_media'].some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  )
}

export function isAppNavigation({ request, url }: { request: Request; url: URL }) {
  return (
    request.mode === 'navigate' &&
    !['/api', '/admin', '/media', '/private_media'].some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    )
  )
}
