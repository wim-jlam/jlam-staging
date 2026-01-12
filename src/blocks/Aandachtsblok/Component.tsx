import type { AandachtsblokBlock as AandachtsblokBlockProps } from 'src/payload-types'

import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

type Props = {
  className?: string
} & AandachtsblokBlockProps

/**
 * Aandachtsblok Component
 * JLAM-style callout with green background and left border
 * Matches the styling from d1-eigenhand's Callout component
 * Uses CSS classes from globals.css for consistent JLAM styling
 */
export const AandachtsblokBlock: React.FC<Props> = ({ className, content }) => {
  return (
    <div className={cn('mx-auto my-8 w-full', className)}>
      <div className="aandachtsblok">
        <RichText data={content} enableGutter={false} enableProse={false} />
      </div>
    </div>
  )
}
