import type { AuteurReviewerBlock as AuteurReviewerBlockProps } from 'src/payload-types'

import { cn } from '@/utilities/ui'
import React from 'react'

type Props = {
  className?: string
} & AuteurReviewerBlockProps

/**
 * AuteurReviewer Component
 * Displays author and reviewer information with beige background
 * Used for medical content credibility
 */
export const AuteurReviewerBlock: React.FC<Props> = ({
  className,
  auteur,
  reviewer,
  reviewerTitel,
}) => {
  // Build reviewer string with optional title
  const reviewerText = reviewer
    ? reviewerTitel
      ? `${reviewer}, ${reviewerTitel}`
      : reviewer
    : null

  return (
    <div className={cn('mx-auto my-8 w-full', className)}>
      <div className="auteur-reviewer-block rounded-lg bg-[#fdf6f0] px-6 py-4">
        <p className="text-base text-gray-800">
          <span className="font-medium">Auteur:</span> {auteur}
          {reviewerText && (
            <>
              {' – '}
              <span className="font-medium">Reviewer:</span> {reviewerText}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
