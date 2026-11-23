import { AppLink } from '@/components/AppLink'
import { Icon } from '@/features/home/icons'
import { jalaliYear } from '@/lib/format'
import { SITE, SOCIAL } from '@/lib/site'
import { Logo } from './Logo'

const footerSocials = SOCIAL.filter((social) => social.href !== 'https://wa.me/')

const supportLinks = [
  { href: '/account/support/', label: 'مرکز پشتیبانی' },
  { href: '/account/support/?new=1', label: 'ثبت درخواست پشتیبانی' },
]

const guidanceLinks = [
  { href: '/support/track/', label: 'پیگیری درخواست' },
  { href: '/contact/#contact-faq-title', label: 'پرسش‌های متداول' },
]

function FooterLinks({
  title,
  description,
  links,
}: {
  title: string
  description: string
  links: typeof supportLinks
}) {
  return (
    <nav className="footer-links" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <AppLink href={link.href}>
              <span>{link.label}</span>
              <Icon name="arrow-l" />
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer" dir="rtl">
      <div className="wrap">
        <div className="footer-main">
          <section className="footer-brand" aria-label="درباره کارفنسا">
            <Logo variant="footer" />
            <span className="footer-eyebrow">بستر ارتباط فعالان اقتصادی ایران</span>
            <h2>{SITE.tagline}</h2>
            <p>{SITE.about}</p>
          </section>
          <FooterLinks
            title="پشتیبانی کاربران"
            description="برای راهنمایی یا ثبت و پیگیری درخواست."
            links={supportLinks}
          />
          <FooterLinks
            title="راهنما و پاسخ‌گویی"
            description="پاسخ پرسش‌های پرتکرار و پیگیری تیکت."
            links={guidanceLinks}
          />
          <section className="footer-trust" aria-labelledby="footer-trust-title">
            <h2 id="footer-trust-title">نشان‌های اعتماد</h2>
            <p>جایگاه نشان‌های رسمی کارفنسا</p>
            <div className="footer-trust-list">
              <div className="footer-trust-slot" aria-label="جایگاه نماد اعتماد الکترونیکی">
                <Icon name="badge-check" />
                <span>اینماد</span>
                <small>محل درج نشان رسمی</small>
              </div>
              <div className="footer-trust-slot" aria-label="جایگاه نماد ساماندهی">
                <Icon name="globe" />
                <span>ساماندهی</span>
                <small>محل درج نشان رسمی</small>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="wrap footer-bottom-inner">
          <p>
            © {jalaliYear(new Date())} <span dir="ltr">{SITE.latin}</span>؛ تمامی حقوق محفوظ است.
          </p>
          <nav className="footer-social" aria-label="شبکه‌های اجتماعی کارفنسا">
            <h3>کارفنسا را دنبال کنید</h3>
            <ul>
              {footerSocials.map((social) => (
                <li key={social.icon}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    title={social.label}
                  >
                    <Icon name={social.icon} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  )
}
