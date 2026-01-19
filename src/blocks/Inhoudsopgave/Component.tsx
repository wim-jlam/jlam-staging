import type { InhoudsopgaveBlock as InhoudsopgaveBlockProps } from 'src/payload-types'
import type { TocItem } from '@/utilities/extractHeadings'

import { cn } from '@/utilities/ui'
import React from 'react'

type Props = {
  className?: string
  generatedItems?: TocItem[] // Passed from RenderBlocks when autoGenerate is true
} & InhoudsopgaveBlockProps

/**
 * Inhoudsopgave Component
 * Table of Contents with numbered list and anchor links
 * Supports both manual items and auto-generated from headings
 * Beige background matching JLAM style
 */
export const InhoudsopgaveBlock: React.FC<Props> = ({
  className,
  titel,
  items,
  autoGenerate,
  generatedItems,
}) => {
  // Use generated items if autoGenerate is enabled
  const tocItems = autoGenerate && generatedItems
    ? generatedItems.map(h => ({ label: h.text, anchor: h.id }))
    : items

  if (!tocItems || tocItems.length === 0) return null

  return (
    <div className={cn('mx-auto my-8 w-full', className)}>
      <div className="inhoudsopgave-block rounded-lg bg-[#fdf6f0] px-6 py-5">
        {titel && <h2 className="mb-4 text-xl font-bold text-gray-900">{titel}</h2>}
        <ol className="list-inside list-decimal space-y-2">
          {tocItems.map((item, index) => (
            <li key={index} className="text-base text-gray-800">
              {item.anchor ? (
                <a
                  href={`#${item.anchor}`}
                  className="text-[#2d5a27] hover:underline"
                >
                  {item.label}
                </a>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
