import { useEffect } from 'react'
import { AnalysisSection } from './AnalysisSection'
import { HomeSlider } from './HomeSlider'
import { TradeOpportunitiesSection } from './TradeOpportunitiesSection'
import { TransportSection } from './TransportSection'
import { HomeIntentSection } from '@/features/intents/HomeIntentSection'
import { PwaPromoCard } from '@/pwa/PwaInstallButton'

export function HomePage() {
  useEffect(() => {
    document.title = 'کارفنسا | صفحه اصلی'
  }, [])

  return (
    <>
      <HomeSlider />
      <TradeOpportunitiesSection />
      <HomeIntentSection />
      <TransportSection />
      <AnalysisSection />
      <PwaPromoCard placement="home" />
      <p className="foot-note">عنوان‌ها و نام‌ها نمونه و فرضی است.</p>
    </>
  )
}
