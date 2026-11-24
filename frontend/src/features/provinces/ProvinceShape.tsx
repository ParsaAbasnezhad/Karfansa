import { useLayoutEffect, useRef, useState } from 'react'
import provinceMap from './iran-provinces-map.json'

export function ProvinceShape({ slug }: { slug: string }) {
  const region = provinceMap.provinces.find((item) => item.slug === slug)
  const pathRef = useRef<SVGPathElement>(null)
  const [viewBox, setViewBox] = useState('0 0 640 570')

  useLayoutEffect(() => {
    const box = typeof pathRef.current?.getBBox === 'function' ? pathRef.current.getBBox() : null
    if (!box) return
    const pad = 4
    setViewBox(`${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`)
  }, [slug])

  if (!region) return null
  return (
    <svg className="province-shape" viewBox={viewBox} aria-hidden="true" focusable="false">
      <path ref={pathRef} d={region.path} />
    </svg>
  )
}
