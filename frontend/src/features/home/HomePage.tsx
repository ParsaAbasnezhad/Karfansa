import { useEffect } from 'react'
import { AnalysisSection } from './AnalysisSection'
import { CompanyNews } from './CompanyNews'
import { HeadlinesSection } from './HeadlinesSection'
import { MarketsStrip } from './MarketsStrip'
import { NewsHero } from './NewsHero'
import { TransportSection } from './TransportSection'

export function HomePage() {
  useEffect(() => {
    document.title = 'کارفنسا | صفحه اصلی'
  }, [])

  return (
    <>
      <section className="top">
        <NewsHero />
        <MarketsStrip />
      </section>
      <TransportSection />
      <CompanyNews />
      <HeadlinesSection />
      <AnalysisSection />
      <p className="foot-note">عنوان‌ها و نام‌ها نمونه و فرضی است.</p>
    </>
  )
}
