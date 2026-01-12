import type { CtaCardBlock as CtaCardBlockProps } from 'src/payload-types'

import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'

type Props = {
  className?: string
} & CtaCardBlockProps

/**
 * CtaCard Component
 * Clickable card for navigation and content promotion
 * Matches the styling from d1-eigenhand's CtaCard component
 */
export const CtaCardBlock: React.FC<Props> = ({
  className,
  title,
  description,
  link,
  ctaText = 'Lees meer',
}) => {
  // Build the href
  let href = '#'
  if (link?.type === 'custom' && link.url) {
    href = link.url
  } else if (link?.type === 'reference' && link.reference) {
    const ref = link.reference as { relationTo: string; value: { slug: string } | string }
    if (typeof ref.value === 'object' && ref.value.slug) {
      href = ref.relationTo === 'posts' ? `/posts/${ref.value.slug}` : `/${ref.value.slug}`
    }
  }

  const CardContent = (
    <div
      className={cn(
        'group flex h-full flex-col rounded-xl border border-border bg-card p-6',
        'transition-all duration-200 hover:border-primary hover:shadow-lg',
        className
      )}
    >
      <h4 className="mb-2 text-lg font-semibold text-foreground group-hover:text-primary">
        {title}
      </h4>
      {description && (
        <p className="mb-4 flex-grow text-sm text-muted-foreground">{description}</p>
      )}
      <span className="inline-flex items-center text-sm font-medium text-primary">
        {ctaText}
        <svg
          className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </div>
  )

  if (link?.newTab) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {CardContent}
      </a>
    )
  }

  return (
    <Link href={href} className="block">
      {CardContent}
    </Link>
  )
}
