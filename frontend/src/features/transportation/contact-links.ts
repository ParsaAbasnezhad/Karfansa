function normalizeDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(digit) % 10))
}

export function phoneHref(value?: string | null) {
  const phone = normalizeDigits(value?.trim() ?? '')
  if (!phone || !/^\+?[\d\s().-]+$/.test(phone)) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 5 || digits.length > 15) return null
  return `tel:${phone.startsWith('+') ? '+' : ''}${digits}`
}

export function emailHref(value?: string | null) {
  const email = value?.trim() ?? ''
  if (
    !/^[-A-Za-z0-9_.+]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
      email,
    )
  ) {
    return null
  }
  const subject = encodeURIComponent('درخواست همکاری با شرکت حمل‌ونقل')
  return `mailto:${email}?subject=${subject}`
}

function safeProfileUrl(value: string, hosts: string[], pathPattern: RegExp) {
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      !hosts.includes(url.hostname.toLowerCase()) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null
    }
    const match = url.pathname.match(pathPattern)
    return match?.[1] ? { username: match[1], search: url.search } : null
  } catch {
    return null
  }
}

export function telegramHref(value?: string | null) {
  const contact = value?.trim() ?? ''
  if (!contact) return null
  const username = contact.startsWith('@') ? contact.slice(1) : contact
  if (/^[A-Za-z0-9_]{5,32}$/.test(username)) return `https://t.me/${username}`

  const profile = safeProfileUrl(
    contact,
    ['t.me', 'telegram.me'],
    /^\/([A-Za-z0-9_]{5,32}|\+[A-Za-z0-9_-]+)\/?$/,
  )
  return profile ? `https://t.me/${profile.username}${profile.search}` : null
}

export function instagramHref(value?: string | null) {
  const contact = value?.trim() ?? ''
  if (!contact) return null
  const username = contact.startsWith('@') ? contact.slice(1) : contact
  const validUsername = (candidate: string) =>
    candidate.length <= 30 &&
    /^[A-Za-z0-9._]+$/.test(candidate) &&
    !candidate.startsWith('.') &&
    !candidate.endsWith('.') &&
    !candidate.includes('..')
  if (validUsername(username)) return `https://www.instagram.com/${username}/`

  const profile = safeProfileUrl(
    contact,
    ['instagram.com', 'www.instagram.com'],
    /^\/([A-Za-z0-9._]+)\/?$/,
  )
  return profile && validUsername(profile.username)
    ? `https://www.instagram.com/${profile.username}/${profile.search}`
    : null
}

export function websiteHref(value?: string | null) {
  try {
    const url = new URL(value?.trim() ?? '')
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null
    }
    return url.href
  } catch {
    return null
  }
}
