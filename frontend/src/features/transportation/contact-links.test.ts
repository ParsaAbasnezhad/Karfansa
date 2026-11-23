import { describe, expect, it } from 'vitest'
import { emailHref, instagramHref, phoneHref, telegramHref, websiteHref } from './contact-links'

describe('transportation contact links', () => {
  it('omits empty contact channels', () => {
    expect(phoneHref('')).toBeNull()
    expect(emailHref(null)).toBeNull()
    expect(telegramHref(undefined)).toBeNull()
    expect(instagramHref('')).toBeNull()
  })

  it('normalizes registered phone numbers and creates collaboration email links', () => {
    expect(phoneHref('+۹۸ (۲۱) ۱۲۳۴-۵۶۷۸')).toBe('tel:+982112345678')
    expect(emailHref('dispatch@example.com')).toContain('mailto:dispatch@example.com?subject=')
  })

  it('accepts registered Telegram and Instagram usernames and profile links', () => {
    expect(telegramHref('@alpha_freight')).toBe('https://t.me/alpha_freight')
    expect(telegramHref('https://telegram.me/alpha_freight/')).toBe('https://t.me/alpha_freight')
    expect(instagramHref('@alpha.freight')).toBe('https://www.instagram.com/alpha.freight/')
    expect(instagramHref('https://instagram.com/alpha.freight/')).toBe(
      'https://www.instagram.com/alpha.freight/',
    )
  })

  it('rejects unsafe, malformed, and untrusted contact values', () => {
    expect(phoneHref('javascript:alert(1)')).toBeNull()
    expect(emailHref('dispatch at example.com')).toBeNull()
    expect(emailHref('dispatch@example.com?subject=injected')).toBeNull()
    expect(telegramHref('javascript:alert(1)')).toBeNull()
    expect(telegramHref('https://example.com/alpha_freight')).toBeNull()
    expect(instagramHref('javascript:alert(1)')).toBeNull()
    expect(instagramHref('https://instagram.com/alpha?igshid=sample')).toBe(
      'https://www.instagram.com/alpha/?igshid=sample',
    )
    expect(instagramHref('http://www.instagram.com/alpha')).toBeNull()
    expect(websiteHref('javascript:alert(1)')).toBeNull()
    expect(websiteHref('https://example.com')).toBe('https://example.com/')
  })
})
