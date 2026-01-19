/**
 * WordPress Page to Payload Page Migration
 *
 * Converts WordPress/Kadence block-based pages to Payload CMS Pages
 * with proper block layout structure.
 *
 * Detects and converts:
 * - Author/Reviewer boxes → AuteurReviewer block
 * - Table of Contents → Inhoudsopgave block
 * - Regular content → Content blocks
 *
 * Usage:
 *   npx tsx scripts/migrate-wordpress-page.ts --slug=page-slug
 *   npx tsx scripts/migrate-wordpress-page.ts --slug=page-slug --dry-run
 */

import 'dotenv/config'
import { parse, HTMLElement } from 'node-html-parser'
import { getPayload } from 'payload'
import config from '../src/payload.config'

// WPGraphQL endpoint
const WP_GRAPHQL_ENDPOINT = 'https://jeleefstijlalsmedicijn.nl/graphql'

// Types
interface PayloadBlock {
  blockType: string
  [key: string]: unknown
}

interface AuteurReviewerBlock extends PayloadBlock {
  blockType: 'auteurReviewer'
  auteur: string
  reviewer?: string
  reviewerTitel?: string
}

interface InhoudsopgaveBlock extends PayloadBlock {
  blockType: 'inhoudsopgave'
  titel: string
  items: Array<{ label: string; anchor?: string }>
}

interface ContentBlock extends PayloadBlock {
  blockType: 'content'
  columns: Array<{
    size: 'full'
    richText: {
      root: {
        type: 'root'
        children: any[]
        direction: 'ltr'
        format: ''
        indent: 0
        version: 1
      }
    }
  }>
}

// Parse arguments
const args = process.argv.slice(2)
const slugArg = args.find(a => a.startsWith('--slug='))
const isDryRun = args.includes('--dry-run')

if (!slugArg) {
  console.error('Usage: npx tsx scripts/migrate-wordpress-page.ts --slug=page-slug [--dry-run]')
  process.exit(1)
}

const pageSlug = slugArg.replace('--slug=', '')

/**
 * Fetch page from WordPress via GraphQL
 */
async function fetchWordPressPage(slug: string) {
  const uri = slug.startsWith('/') ? slug : `/${slug}/`

  const query = `
    query GetPage($uri: ID!) {
      page(id: $uri, idType: URI) {
        title
        slug
        content
        date
        modified
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
  `

  const response = await fetch(WP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { uri } }),
  })

  const json = await response.json()
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2))
  }
  return json.data?.page
}

/**
 * Detect author/reviewer text pattern
 */
function parseAuteurReviewer(text: string): AuteurReviewerBlock | null {
  // Pattern: "Auteur: Name – Reviewer: Name, Title"
  const auteurMatch = text.match(/Auteur:\s*([^–-]+)/i)
  const reviewerMatch = text.match(/Reviewer:\s*([^,]+)(?:,\s*(.+))?/i)

  if (!auteurMatch) return null

  return {
    blockType: 'auteurReviewer',
    auteur: auteurMatch[1].trim(),
    reviewer: reviewerMatch?.[1]?.trim(),
    reviewerTitel: reviewerMatch?.[2]?.trim(),
  }
}

/**
 * Parse Table of Contents from HTML
 */
function parseTocItems(tocElement: HTMLElement): InhoudsopgaveBlock | null {
  const items: Array<{ label: string; anchor?: string }> = []
  const seen = new Set<string>()

  // Only get direct li elements to avoid duplicates
  const listItems = tocElement.querySelectorAll('li')
  listItems.forEach(li => {
    const anchor = li.querySelector('a')
    const text = (anchor || li).textContent?.trim()

    // Skip duplicates and empty items
    if (!text || seen.has(text)) return
    seen.add(text)

    const href = anchor?.getAttribute('href') || ''
    const anchorId = href.startsWith('#') ? href.slice(1) : undefined

    items.push({ label: text, anchor: anchorId })
  })

  if (items.length === 0) return null

  return {
    blockType: 'inhoudsopgave',
    titel: 'Inhoudsopgave',
    items,
  }
}

/**
 * Convert HTML text to Lexical paragraph
 */
function textToParagraph(text: string): any {
  return {
    type: 'paragraph',
    children: [{ type: 'text', text: text.trim(), version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    version: 1,
  }
}

/**
 * Convert HTML element to Lexical nodes
 */
function elementToLexicalNodes(el: HTMLElement): any[] {
  const nodes: any[] = []
  const tag = el.tagName?.toLowerCase()

  // Headings
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const text = el.textContent?.trim()
    if (text) {
      // Generate anchor ID from heading text
      const id = el.getAttribute('id') || text.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      nodes.push({
        type: 'heading',
        tag: tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
        children: [{ type: 'text', text, version: 1 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })
    }
    return nodes
  }

  // Paragraphs
  if (tag === 'p') {
    const text = el.textContent?.trim()
    if (text) {
      nodes.push(textToParagraph(text))
    }
    return nodes
  }

  // Lists
  if (tag === 'ul' || tag === 'ol') {
    const listItems: any[] = []
    let value = 1

    for (const child of el.childNodes) {
      if (child.nodeType === 1 && (child as HTMLElement).tagName?.toLowerCase() === 'li') {
        const li = child as HTMLElement
        const text = li.textContent?.trim()
        if (text) {
          listItems.push({
            type: 'listitem',
            children: [{
              type: 'paragraph',
              children: [{ type: 'text', text, version: 1 }],
              direction: 'ltr',
              format: '',
              indent: 0,
              textFormat: 0,
              version: 1,
            }],
            direction: 'ltr',
            format: '',
            indent: 0,
            value: value++,
            version: 1,
          })
        }
      }
    }

    if (listItems.length > 0) {
      nodes.push({
        type: 'list',
        listType: tag === 'ol' ? 'number' : 'bullet',
        start: 1,
        tag: tag,
        children: listItems,
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      })
    }
    return nodes
  }

  // Divs and containers - process children
  if (['div', 'span', 'section', 'article'].includes(tag)) {
    for (const child of el.childNodes) {
      if (child.nodeType === 3) {
        const text = (child as unknown as Text).textContent?.trim()
        if (text) {
          nodes.push(textToParagraph(text))
        }
      } else if (child.nodeType === 1) {
        nodes.push(...elementToLexicalNodes(child as HTMLElement))
      }
    }
    return nodes
  }

  // Fallback: extract text content
  const text = el.textContent?.trim()
  if (text) {
    nodes.push(textToParagraph(text))
  }

  return nodes
}

/**
 * Convert HTML to Lexical richtext state
 */
function htmlToLexical(html: string): any {
  const root = parse(html)
  const children: any[] = []

  for (const node of root.childNodes) {
    if (node.nodeType === 3) {
      const text = (node as unknown as Text).textContent?.trim()
      if (text) {
        children.push(textToParagraph(text))
      }
    } else if (node.nodeType === 1) {
      children.push(...elementToLexicalNodes(node as HTMLElement))
    }
  }

  if (children.length === 0) {
    children.push(textToParagraph(''))
  }

  return {
    root: {
      type: 'root',
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/**
 * Create a Content block
 */
function createContentBlock(html: string): ContentBlock {
  return {
    blockType: 'content',
    columns: [{
      size: 'full',
      richText: htmlToLexical(html),
    }],
  }
}

/**
 * Clean HTML: remove styles, strip classes
 */
function cleanHtml(html: string): string {
  const root = parse(html, { comment: false })

  // Remove style tags
  root.querySelectorAll('style').forEach(el => el.remove())

  // Remove spacers
  root.querySelectorAll('.wp-block-kadence-spacer').forEach(el => el.remove())

  // Remove interactive elements
  root.querySelectorAll('.hs-cta-embed, [class*="hs-cta"]').forEach(el => el.remove())

  // Strip classes and styles
  root.querySelectorAll('[class]').forEach(el => el.removeAttribute('class'))
  root.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'))

  return root.toString()
}

/**
 * Parse WordPress content into Payload blocks
 */
function parseToPayloadBlocks(html: string): PayloadBlock[] {
  const blocks: PayloadBlock[] = []
  const root = parse(html, { comment: false })

  // Collect blocks in order - we'll sort them later
  const introBlocks: PayloadBlock[] = []
  let auteurBlock: AuteurReviewerBlock | null = null
  let tocBlock: InhoudsopgaveBlock | null = null

  // 1. Find Author/Reviewer box (but don't add yet - we need intro first)
  const advancedHeadings = root.querySelectorAll('.wp-block-kadence-advancedheading')
  for (const heading of advancedHeadings) {
    const text = heading.textContent || ''
    if (text.toLowerCase().includes('auteur:')) {
      auteurBlock = parseAuteurReviewer(text)
      if (auteurBlock) {
        console.log(`   👤 Found author/reviewer: ${auteurBlock.auteur}`)
        // Mark for removal by adding a data attribute
        heading.setAttribute('data-remove', 'true')
      }
    }
  }

  // Also check for <sub> tags with author info
  const subTags = root.querySelectorAll('sub')
  for (const sub of subTags) {
    const text = sub.textContent || ''
    if (text.toLowerCase().includes('auteur:') && !auteurBlock) {
      auteurBlock = parseAuteurReviewer(text)
      if (auteurBlock) {
        console.log(`   👤 Found author/reviewer: ${auteurBlock.auteur}`)
        const parent = sub.parentNode
        if (parent) {
          (parent as HTMLElement).setAttribute('data-remove', 'true')
        }
      }
    }
  }

  // 2. Find Table of Contents (but don't add yet)
  const tocElements = root.querySelectorAll('.wp-block-kadence-tableofcontents, nav.kb-table-of-content-nav, .kb-table-of-content-wrap')
  for (const toc of tocElements) {
    if (!tocBlock) {
      tocBlock = parseTocItems(toc)
      if (tocBlock) {
        console.log(`   📑 Found TOC with ${tocBlock.items.length} items`)
      }
    }
    toc.setAttribute('data-remove', 'true')
  }

  // Remove marked elements
  root.querySelectorAll('[data-remove="true"]').forEach(el => el.remove())

  // 3. Remove promotional content
  const promotionalPatterns = ['Recept ideëen', 'nieuwsbrief', 'Sterren geven']
  root.querySelectorAll('.wp-block-kadence-rowlayout, .kb-row-layout-wrap').forEach((row) => {
    const text = row.textContent || ''
    if (promotionalPatterns.some(p => text.toLowerCase().includes(p.toLowerCase()))) {
      row.remove()
    }
  })

  // 4. Process rows - first row is usually intro, rest is content
  const rows = root.querySelectorAll('.wp-block-kadence-rowlayout, .kb-row-layout-wrap')
  const contentBlocks: PayloadBlock[] = []
  let isFirstContentRow = true

  if (rows.length === 0) {
    // No row structure - treat as single content block
    const cleaned = cleanHtml(root.toString())
    if (cleaned.trim()) {
      contentBlocks.push(createContentBlock(cleaned))
    }
  } else {
    rows.forEach((row) => {
      const columns = row.querySelectorAll('.wp-block-kadence-column')

      let rowHtml = ''
      columns.forEach((col) => {
        const inner = col.querySelector('.kt-inside-inner-col')
        rowHtml += inner?.innerHTML || col.innerHTML
      })

      if (!rowHtml.trim()) {
        rowHtml = row.innerHTML
      }

      const cleaned = cleanHtml(rowHtml)
      if (cleaned.trim()) {
        const block = createContentBlock(cleaned)

        // Check if this is intro content (before first H2)
        const hasH2 = /<h2/i.test(cleaned)
        if (isFirstContentRow && !hasH2) {
          // This is intro content - add it first
          introBlocks.push(block)
        } else {
          isFirstContentRow = false
          contentBlocks.push(block)
        }
      }
    })
  }

  // 5. Assemble blocks in correct order: intro → auteur → toc → content
  if (introBlocks.length > 0) {
    console.log(`   📝 Found ${introBlocks.length} intro block(s)`)
    blocks.push(...introBlocks)
  }

  if (auteurBlock) {
    blocks.push(auteurBlock)
  }

  if (tocBlock) {
    blocks.push(tocBlock)
  }

  blocks.push(...contentBlocks)

  return blocks
}

/**
 * Main migration function
 */
async function main() {
  console.log(`\n📦 WordPress Page → Payload Page Migration\n`)
  console.log(`Slug: ${pageSlug}`)
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`)

  // Fetch from WordPress
  console.log('📥 Fetching from WordPress...')
  const wpPage = await fetchWordPressPage(pageSlug)

  if (!wpPage) {
    console.error(`❌ Page not found: ${pageSlug}`)
    process.exit(1)
  }

  console.log(`   Title: ${wpPage.title}`)
  console.log(`   Content length: ${wpPage.content?.length || 0} chars`)

  // Parse to Payload blocks
  console.log('\n🔄 Converting to Payload blocks...')
  const layout = parseToPayloadBlocks(wpPage.content || '')
  console.log(`   Created ${layout.length} blocks:`)

  const blockCounts: Record<string, number> = {}
  layout.forEach(b => {
    blockCounts[b.blockType] = (blockCounts[b.blockType] || 0) + 1
  })
  Object.entries(blockCounts).forEach(([type, count]) => {
    console.log(`     - ${type}: ${count}`)
  })

  if (isDryRun) {
    console.log('\n📋 DRY RUN - Preview of blocks:')
    layout.slice(0, 5).forEach((block, i) => {
      console.log(`\n--- Block ${i + 1} (${block.blockType}) ---`)
      if (block.blockType === 'auteurReviewer') {
        const b = block as AuteurReviewerBlock
        console.log(`Auteur: ${b.auteur}`)
        console.log(`Reviewer: ${b.reviewer || '-'} ${b.reviewerTitel ? `(${b.reviewerTitel})` : ''}`)
      } else if (block.blockType === 'inhoudsopgave') {
        const b = block as InhoudsopgaveBlock
        b.items.forEach((item, j) => console.log(`  ${j + 1}. ${item.label}`))
      } else {
        console.log(JSON.stringify(block, null, 2).slice(0, 300) + '...')
      }
    })
    console.log('\n✅ Dry run complete. Run without --dry-run to create page.')
    process.exit(0)
  }

  // Create in Payload
  console.log('\n📤 Creating in Payload...')
  const payload = await getPayload({ config })

  // Check if page exists
  const existing = await payload.find({
    collection: 'pages',
    where: { slug: { equals: pageSlug } },
    limit: 1,
  })

  let page
  if (existing.docs.length > 0) {
    console.log(`⚠️  Page already exists with slug: ${pageSlug} - updating...`)
    page = await payload.update({
      collection: 'pages',
      id: existing.docs[0].id,
      data: {
        title: wpPage.title,
        layout,
        meta: {
          title: wpPage.title,
          description: '',
        },
      },
      context: { disableRevalidate: true },
    })
  } else {
    // Create page
    page = await payload.create({
      collection: 'pages',
      data: {
        title: wpPage.title,
        slug: pageSlug,
        layout,
        meta: {
          title: wpPage.title,
          description: '',
        },
        _status: 'draft',
      },
      context: { disableRevalidate: true },
    })
  }

  console.log(`\n✅ Page created!`)
  console.log(`   ID: ${page.id}`)
  console.log(`   URL: http://localhost:3000/admin/collections/pages/${page.id}`)

  await payload.db.destroy()
  process.exit(0)
}

main().catch(error => {
  console.error('💥 Migration failed:', error)
  process.exit(1)
})
