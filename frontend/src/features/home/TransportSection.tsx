import { useState } from 'react'
import { AppLink } from '@/components/AppLink'
import { formatNumber } from '@/lib/format'
import { URLS } from '@/lib/site'
import type { TransportCompany, TransportFilter } from '@/lib/types'
import { TRANSPORT_TABS, TRANSPORT_TYPES, useTransportCompanies } from './data'
import { Icon } from './icons'
import { ErrorBox, SectionHead, Skeleton, Tabs } from './parts'

function CompanyCard({ company }: { company: TransportCompany }) {
  const type = TRANSPORT_TYPES[company.type]
  return (
    <AppLink className={`tcard ${type.cls}`} href={company.url}>
      <div className="row1">
        <span className="tic">
          <Icon name={type.icon} />
        </span>
        <div className="tt">
          <h3>
            {company.name}
            <span className="pill">{type.label}</span>
          </h3>
          <p>{company.description}</p>
        </div>
      </div>
      <div className="stats">
        <span>
          <Icon name="pin" />
          {company.city}
        </span>
        <span>
          <Icon name="box" />
          {formatNumber(company.fleet_count)} {company.fleet_unit}
        </span>
        <span>
          <Icon name="route" />
          {formatNumber(company.route_count)} {company.route_unit}
        </span>
      </div>
    </AppLink>
  )
}

export function TransportSection() {
  const [type, setType] = useState<TransportFilter>('all')
  const { data, isError, isPlaceholderData, refetch } = useTransportCompanies(type)
  const tabs = TRANSPORT_TABS.map((t) => ({ ...t, count: data?.counts[t.key] }))

  return (
    <section className="panel sec" id="transport">
      <SectionHead
        icon="truck"
        title="شرکت‌های حمل و نقل"
        sub="معرفی و رصد فعالان حمل‌ونقل جاده‌ای، دریایی، ریلی، هوایی و لجستیک"
      >
        <AppLink className="link" href={URLS.transportAll}>
          <Icon name="arrow-l" />
          مشاهده همه
        </AppLink>
        <AppLink className="btn" href={URLS.registerTransport}>
          <Icon name="building" />
          ثبت شرکت حمل‌ونقل
        </AppLink>
      </SectionHead>
      <Tabs items={tabs} value={type} onChange={setType} label="نوع شرکت" />
      {isError && !data ? (
        <ErrorBox onRetry={() => void refetch()} />
      ) : (
        <div className="tgrid" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
          {data
            ? data.results.map((c) => <CompanyCard key={c.id} company={c} />)
            : Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={150} />)}
        </div>
      )}
    </section>
  )
}
