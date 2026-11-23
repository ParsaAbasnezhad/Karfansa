import { useEffect } from 'react'
import { AnalysisSection } from './AnalysisSection'
import { HomeSlider } from './HomeSlider'
import { MarketsStrip } from './MarketsStrip'
import { TradeOpportunitiesSection } from './TradeOpportunitiesSection'
import { TransportSection } from './TransportSection'
import { HomeIntentSection } from '@/features/intents/HomeIntentSection'

export function HomePage() {
  useEffect(() => {
    document.title = 'کارفنسا | صفحه اصلی'
  }, [])

  return (
    <>
      <HomeSlider />
      <TradeOpportunitiesSection />
      <HomeIntentSection />
      <MarketsStrip />
      <TransportSection />
      <AnalysisSection />
      <p className="foot-note">عنوان‌ها و نام‌ها نمونه و فرضی است.</p>
    </>
  )
}
