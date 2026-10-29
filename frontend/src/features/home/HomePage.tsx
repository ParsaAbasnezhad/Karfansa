import { Link } from 'react-router-dom'
import { Audiences } from './Audiences'
import { HowItWorks } from './HowItWorks'
import { ResultAnatomy } from './ResultAnatomy'
import { SearchForm } from './SearchForm'

const examples = ['زعفران', 'پسته', 'گلیم']

export function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__inner">
          <div className="hero__copy">
            <h1 className="hero__title" id="hero-title">
              تأمین‌کننده‌ی هر محصول را با منبعش پیدا کنید
            </h1>
            <p className="hero__lead">
              کارفنسا اول در شرکت‌های ثبت‌شده‌ی خودش می‌گردد. اگر لازم شد، منابع دیگر را هم بررسی
              می‌کند و کنار هر نتیجه می‌نویسد از کجا آمده.
            </p>
            <SearchForm />
            <p className="hero__examples">
              نمونه‌ی جست‌وجو:
              {examples.map((item) => (
                <Link key={item} to={`/search?q=${encodeURIComponent(item)}`}>
                  {item}
                </Link>
              ))}
            </p>
          </div>
          <ResultAnatomy />
        </div>
      </section>
      <HowItWorks />
      <Audiences />
    </>
  )
}
