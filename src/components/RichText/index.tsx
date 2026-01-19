import { MediaBlock } from '@/blocks/MediaBlock/Component'
import {
  DefaultNodeTypes,
  SerializedBlockNode,
  SerializedLinkNode,
  type DefaultTypedEditorState,
} from '@payloadcms/richtext-lexical'
import {
  JSXConvertersFunction,
  LinkJSXConverter,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'

import { AandachtsblokBlock } from '@/blocks/Aandachtsblok/Component'
import { CodeBlock, CodeBlockProps } from '@/blocks/Code/Component'
import { CtaCardBlock } from '@/blocks/CtaCard/Component'

import type {
  AandachtsblokBlock as AandachtsblokBlockProps,
  BannerBlock as BannerBlockProps,
  CallToActionBlock as CTABlockProps,
  CtaCardBlock as CtaCardBlockProps,
  MediaBlock as MediaBlockProps,
} from '@/payload-types'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { cn } from '@/utilities/ui'
import { generateHeadingId } from '@/utilities/extractHeadings'

type NodeTypes =
  | DefaultNodeTypes
  | SerializedBlockNode<AandachtsblokBlockProps | CTABlockProps | CtaCardBlockProps | MediaBlockProps | BannerBlockProps | CodeBlockProps>

const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }) => {
  const { value, relationTo } = linkNode.fields.doc!
  if (typeof value !== 'object') {
    throw new Error('Expected value to be an object')
  }
  const slug = value.slug
  return relationTo === 'posts' ? `/posts/${slug}` : `/${slug}`
}

/**
 * Extract text content from children nodes
 */
function extractTextFromChildren(children: any): string {
  if (!children) return ''
  if (typeof children === 'string') return children
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('')
  }
  if (children.props?.children) {
    return extractTextFromChildren(children.props.children)
  }
  return ''
}

const jsxConverters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  // Override heading converter to add IDs for TOC linking
  heading: ({ node, nodesToJSX }) => {
    const children = nodesToJSX({ nodes: node.children })
    const text = node.children?.map((c: any) => c.text || '').join('') || ''
    const id = generateHeadingId(text)
    const Tag = node.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
    return <Tag id={id} key={id}>{children}</Tag>
  },
  blocks: {
    aandachtsblok: ({ node }) => <AandachtsblokBlock className="col-start-2 mb-4" {...node.fields} />,
    banner: ({ node }) => <BannerBlock className="col-start-2 mb-4" {...node.fields} />,
    ctaCard: ({ node }) => <CtaCardBlock className="col-start-2 mb-4" {...node.fields} />,
    mediaBlock: ({ node }) => (
      <MediaBlock
        className="col-start-1 col-span-3"
        imgClassName="m-0"
        {...node.fields}
        captionClassName="mx-auto max-w-[48rem]"
        enableGutter={false}
        disableInnerContainer={true}
      />
    ),
    code: ({ node }) => <CodeBlock className="col-start-2" {...node.fields} />,
    cta: ({ node }) => <CallToActionBlock {...node.fields} />,
  },
})

type Props = {
  data: DefaultTypedEditorState
  enableGutter?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText(props: Props) {
  const { className, enableProse = true, enableGutter = true, ...rest } = props
  return (
    <ConvertRichText
      converters={jsxConverters}
      className={cn(
        'payload-richtext',
        {
          container: enableGutter,
          'max-w-none': !enableGutter,
          'mx-auto prose md:prose-md dark:prose-invert': enableProse,
        },
        className,
      )}
      {...rest}
    />
  )
}
