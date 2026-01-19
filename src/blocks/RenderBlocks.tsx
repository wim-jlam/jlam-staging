import React, { Fragment, useMemo } from 'react'

import type { Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { AuteurReviewerBlock } from '@/blocks/AuteurReviewer/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { InhoudsopgaveBlock } from '@/blocks/Inhoudsopgave/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { extractHeadingsFromLayout } from '@/utilities/extractHeadings'

const blockComponents = {
  archive: ArchiveBlock,
  auteurReviewer: AuteurReviewerBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  inhoudsopgave: InhoudsopgaveBlock,
  mediaBlock: MediaBlock,
}

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  // Extract headings from all content blocks for auto-generated TOC
  const generatedHeadings = useMemo(() => {
    if (!hasBlocks) return []
    return extractHeadingsFromLayout(blocks)
  }, [blocks, hasBlocks])

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              // Pass generated headings to inhoudsopgave block
              const extraProps = blockType === 'inhoudsopgave'
                ? { generatedItems: generatedHeadings }
                : {}

              return (
                <div className="my-16" key={index}>
                  {/* @ts-expect-error there may be some mismatch between the expected types here */}
                  <Block {...block} {...extraProps} disableInnerContainer />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
