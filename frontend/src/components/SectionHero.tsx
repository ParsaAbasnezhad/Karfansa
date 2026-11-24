import type { ReactNode } from 'react'
import styles from './SectionHero.module.css'

type VisualVariant = 'services' | 'industries' | 'trade' | 'provinces' | 'directory'

type SectionHeroProps = {
  eyebrow: ReactNode
  title: ReactNode
  description: ReactNode
  image?: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  meta?: ReactNode
  visualVariant: VisualVariant
  className?: string
  as?: 'header' | 'section'
}

export function SectionHero({
  eyebrow,
  title,
  description,
  image,
  primaryAction,
  secondaryAction,
  meta,
  visualVariant,
  className = '',
  as: Element = 'header',
}: SectionHeroProps) {
  return (
    <Element
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      data-visual-variant={visualVariant}
      dir="rtl"
    >
      <div className={styles.copy}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {(primaryAction || secondaryAction) && (
          <div className={styles.actions}>
            {primaryAction}
            {secondaryAction}
          </div>
        )}
        {meta && <div className={styles.meta}>{meta}</div>}
      </div>
      {image && (
        <div className={styles.visual} aria-hidden="true">
          <img src={image} alt="" width="560" height="300" decoding="async" />
        </div>
      )}
    </Element>
  )
}
