import { AppLink } from '@/components/AppLink'
import { Icon } from '@/features/home/icons'
import { StatusChip } from '@/features/system/StatusChip'
import { jalaliYear } from '@/lib/format'
import {
  FOOTER_ABOUT,
  FOOTER_QUICK,
  FOOTER_SECTIONS,
  SITE,
  SOCIAL,
  type LinkItem,
} from '@/lib/site'
import { Logo } from './Logo'

function LinkList({ title, links }: { title: string; links: LinkItem[] }) {
  return (
    <div>
      <h5>{title}</h5>
      <ul>
        {links.map((l) => (
          <li key={l.href + l.label}>
            <AppLink href={l.href}>{l.label}</AppLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="fcols">
          <div className="about">
            <Logo variant="footer" />
            <p>{SITE.about}</p>
            <div className="soc">
              {SOCIAL.map((s) => (
                <a
                  key={s.icon}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                >
                  <Icon name={s.icon} />
                </a>
              ))}
            </div>
          </div>
          <LinkList title="بخش‌ها" links={FOOTER_SECTIONS} />
          <LinkList title="دسترسی سریع" links={FOOTER_QUICK} />
          <LinkList title="درباره کارفنسا" links={FOOTER_ABOUT} />
          <div>
            <h5>تماس با ما</h5>
            <div className="contact">
              {SITE.address && (
                <div className="it">
                  <Icon name="pin" />
                  <b>نشانی</b>
                  <span>{SITE.address}</span>
                </div>
              )}
              {SITE.phone && (
                <div className="it">
                  <Icon name="phone" />
                  <b>تلفن</b>
                  <span className="ltr">{SITE.phone}</span>
                </div>
              )}
              <div className="it">
                <Icon name="mail" />
                <b>{SITE.email ? 'ایمیل' : 'پیام'}</b>
                {SITE.email ? (
                  <span className="ltr">{SITE.email}</span>
                ) : (
                  <AppLink href="/contact/">فرم تماس</AppLink>
                )}
              </div>
              <div className="trust">
                <div>جایگاه نماد اعتماد</div>
                <div>جایگاه نماد ساماندهی</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="copy">
        <div className="wrap">
          <span>
            کپی‌رایت {jalaliYear(new Date())} {SITE.latin}؛ تمامی حقوق این وبسایت محفوظ است.
          </span>
          <div className="mid">
            <span>تهران، ایران</span>
            <StatusChip />
          </div>
          <button
            type="button"
            className="totop"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <Icon name="arrow-up" />
            بازگشت به بالا
          </button>
        </div>
      </div>
    </footer>
  )
}
