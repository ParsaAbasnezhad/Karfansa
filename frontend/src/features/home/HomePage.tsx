import { useEffect } from 'react'
import { AnalysisSection } from './AnalysisSection'
import { HomeSlider } from './HomeSlider'
import { MarketsStrip } from './MarketsStrip'
import { TradeOpportunitiesSection } from './TradeOpportunitiesSection'
import { TransportSection } from './TransportSection'

export function HomePage() {
  useEffect(() => {
    document.title = 'کارفنسا | صفحه اصلی'
  }, [])

  return (
    <>
      <HomeSlider />
      <TradeOpportunitiesSection />
      <MarketsStrip />
      <TransportSection />
      <AnalysisSection />
      <p className="foot-note">عنوان‌ها و نام‌ها نمونه و فرضی است.</p>
    </>
  )
}
