/**
 * WordPress to Payload CMS Migration Script
 *
 * Usage:
 *   npx tsx scripts/migrate-from-wordpress.ts --slug=artikel-slug
 *   npx tsx scripts/migrate-from-wordpress.ts --slug=artikel-slug --dry-run
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'
import { parse as parseHtml, HTMLElement } from 'node-html-parser'

/**
 * Decode HTML entities to their actual characters
 * Handles named entities (&nbsp;, &gt;, etc.) and numeric entities (&#8211;, &#x2014;, etc.)
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return ''

  // Named entities mapping
  const namedEntities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&ndash;': '\u2013',
    '&mdash;': '\u2014',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&hellip;': '…',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥',
    '&cent;': '¢',
    '&deg;': '°',
    '&plusmn;': '±',
    '&times;': '×',
    '&divide;': '÷',
    '&frac12;': '½',
    '&frac14;': '¼',
    '&frac34;': '¾',
  }

  let decoded = text

  // Replace named entities
  for (const [entity, char] of Object.entries(namedEntities)) {
    decoded = decoded.split(entity).join(char)
  }

  // Replace decimal numeric entities (&#8211; → –)
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10))
  })

  // Replace hexadecimal numeric entities (&#x2014; → —)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16))
  })

  return decoded
}

const WP_GRAPHQL_ENDPOINT = 'https://jeleefstijlalsmedicijn.nl/graphql'

// Parse command line arguments
const args = process.argv.slice(2)
const slug = args.find(a => a.startsWith('--slug='))?.split('=')[1]
const dryRun = args.includes('--dry-run')

if (!slug) {
  console.error('Usage: npx tsx scripts/migrate-from-wordpress.ts --slug=artikel-slug [--dry-run]')
  process.exit(1)
}

interface WordPressPost {
  title: string
  slug: string
  content: string
  excerpt: string
  date: string
  modified: string
  featuredImage?: {
    node: {
      sourceUrl: string
      altText: string
      mediaDetails?: {
        width: number
        height: number
      }
    }
  }
  categories?: {
    nodes: Array<{ name: string; slug: string }>
  }
}

/**
 * Fetch a post OR page from WordPress GraphQL using contentNode
 */
async function fetchWordPressPost(postSlug: string): Promise<WordPressPost | null> {
  // Use contentNode which can fetch both posts and pages by URI/slug
  const query = `
    query GetContent($slug: ID!) {
      contentNode(id: $slug, idType: URI) {
        __typename
        ... on Post {
          title
          slug
          content
          excerpt
          date
          modified
          featuredImage {
            node {
              sourceUrl
              altText
              mediaDetails {
                width
                height
              }
            }
          }
          categories {
            nodes {
              name
              slug
            }
          }
        }
        ... on Page {
          title
          slug
          content
          date
          modified
          featuredImage {
            node {
              sourceUrl
              altText
              mediaDetails {
                width
                height
              }
            }
          }
        }
      }
    }
  `

  const response = await fetch(WP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { slug: postSlug } })
  })

  const json = await response.json()

  if (json.errors) {
    console.error('GraphQL errors:', json.errors)
    return null
  }

  const node = json.data?.contentNode
  if (!node) return null

  // Normalize the response (pages don't have excerpt or categories)
  return {
    ...node,
    excerpt: node.excerpt || '',
    categories: node.categories || { nodes: [] },
  }
}

/**
 * Clean WordPress HTML content using proper DOM parsing
 * Based on d1-eigenhand block-converter.ts - strips ALL Kadence/WordPress markup
 */
function cleanWordPressHtml(html: string): string {
  if (!html) return ''

  // Pre-process: Remove WordPress block comments
  let cleaned = html.replace(/<!-- \/?wp:[^>]+ -->/g, '')

  // Fix malformed closing tags from Kadence tables (e.g., </275504_237d01-dd>)
  cleaned = cleaned.replace(/<\/[0-9][a-z0-9_-]*>/gi, '')

  // Parse HTML
  const root = parseHtml(cleaned, {
    lowerCaseTagName: false,
    comment: false,
  })

  // 1. Remove all <style> tags FIRST (before processing)
  root.querySelectorAll('style').forEach((el) => el.remove())

  // 2. Remove all <script> tags
  root.querySelectorAll('script').forEach((el) => el.remove())

  // 3. Remove HubSpot CTAs and promotional content
  root.querySelectorAll('.hs-cta-embed, [class*="hs-cta"]').forEach((el) => el.remove())

  // 4. Remove WPRM interactive elements
  root.querySelectorAll('.wprm-recipe-user-rating, .wprm-user-rating, .wprm-recipe-rating, .wprm-recipe-call-to-action, .wprm-call-to-action, .wprm-recipe-print, .wprm-recipe-pin, .wprm-cta-rating-modal, [class*="wprm-recipe-jump"]').forEach((el) => el.remove())

  // 5. Remove Slickstream save buttons
  root.querySelectorAll('[class*="slickstream"], .wprm-recipe-slickstream').forEach((el) => el.remove())

  // 6. Remove screen-reader only text
  root.querySelectorAll('.sr-only, .screen-reader-text, .wprm-screen-reader-text').forEach((el) => el.remove())

  // 7. Remove HubSpot tracking
  root.querySelectorAll('[id*="hubspot"], [class*="hubspot"]').forEach((el) => el.remove())

  // 8. Remove Kadence galleries
  root.querySelectorAll('.wp-block-kadence-advancedgallery').forEach((el) => el.remove())

  // 9. Remove Kadence icon SVGs
  root.querySelectorAll('.kb-svg-icon-wrap, .kt-svg-icon-list-single').forEach((el) => el.remove())
  root.querySelectorAll('svg').forEach((svg) => {
    if (!svg.getAttribute('width') && !svg.getAttribute('height')) {
      svg.remove()
    }
  })

  // 10. Remove invalid event handlers
  const invalidEventAttrs = ['onclick', 'onmouseenter', 'onmouseleave', 'onfocus', 'onblur', 'onkeypress', 'onerror', 'onload']
  root.querySelectorAll('*').forEach((el) => {
    invalidEventAttrs.forEach((attr) => {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr)
      }
    })
  })

  // 11. Strip WordPress/Kadence wrapper divs - unwrap content
  const wrappers = root.querySelectorAll(
    '[class*="wp-block-"], [class*="kb-"], [class*="kt-"], [class*="kadence"], [class*="wprm-"]'
  )

  wrappers.forEach((wrapper) => {
    if (wrapper.tagName === 'DIV' || wrapper.tagName === 'SECTION' || wrapper.tagName === 'FIGURE') {
      const parent = wrapper.parentNode
      if (parent && wrapper.childNodes.length > 0) {
        wrapper.replaceWith(...wrapper.childNodes)
      } else if (parent) {
        wrapper.remove()
      }
    } else {
      wrapper.removeAttribute('class')
      wrapper.removeAttribute('style')
    }
  })

  // 12. Remove ALL class attributes (clean slate for Payload)
  root.querySelectorAll('[class]').forEach((el) => {
    el.removeAttribute('class')
  })

  // 13. Remove ALL inline styles
  root.querySelectorAll('[style]').forEach((el) => {
    el.removeAttribute('style')
  })

  // 14. Remove ALL data attributes and WordPress-specific IDs
  root.querySelectorAll('*').forEach((el) => {
    const attrs = el.attributes
    Object.keys(attrs).forEach((attr) => {
      if (attr.startsWith('data-')) {
        el.removeAttribute(attr)
      }
    })

    const id = el.getAttribute('id') || ''
    if (id.includes('wprm-') || id.includes('recipe-') || id.includes('kb-') || id.includes('kt-') || id.includes('kadence')) {
      el.removeAttribute('id')
    }
  })

  // 15. Clean up empty elements
  root.querySelectorAll('p').forEach((p) => {
    const text = p.textContent?.trim() || ''
    if (!text && !p.querySelector('img, a, mark')) {
      p.remove()
    }
  })

  root.querySelectorAll('div, span').forEach((el) => {
    if (!el.innerHTML?.trim()) {
      el.remove()
    }
  })

  return root.toString().trim()
}

/**
 * Parse an HTML table and convert to Lexical table format
 */
function parseHtmlTable(tableHtml: string): SerializedLexicalNode | null {
  // Extract rows
  const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi)
  if (!rowMatches || rowMatches.length === 0) return null

  const rows: SerializedLexicalNode[] = []

  for (const rowHtml of rowMatches) {
    // Extract cells (th or td)
    const cellMatches = rowHtml.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi)
    if (!cellMatches) continue

    const cells: SerializedLexicalNode[] = []

    for (const cellHtml of cellMatches) {
      const isHeader = cellHtml.toLowerCase().startsWith('<th')
      const cellContent = decodeHtmlEntities(
        cellHtml
          .replace(/<\/?t[hd][^>]*>/gi, '')
          .replace(/<[^>]+>/g, '')
          .trim()
      )

      cells.push({
        type: 'tablecell',
        children: [{
          type: 'paragraph',
          children: cellContent ? [{ type: 'text', text: cellContent, version: 1 }] : [],
          direction: 'ltr',
          format: '',
          indent: 0,
          textFormat: 0,
          version: 1,
        }],
        colSpan: 1,
        rowSpan: 1,
        headerState: isHeader ? 1 : 0,
        width: undefined,
        backgroundColor: undefined,
        version: 1,
      } as SerializedLexicalNode)
    }

    if (cells.length > 0) {
      rows.push({
        type: 'tablerow',
        children: cells,
        height: undefined,
        version: 1,
      } as SerializedLexicalNode)
    }
  }

  if (rows.length === 0) return null

  return {
    type: 'table',
    children: rows,
    version: 1,
  } as SerializedLexicalNode
}

/**
 * Parse a list (ul/ol) into Lexical list node
 */
function parseHtmlList(listHtml: string, isOrdered: boolean): SerializedLexicalNode | null {
  const doc = parseHtml(listHtml)
  const items = doc.querySelectorAll('li')

  if (items.length === 0) return null

  const listItems: SerializedLexicalNode[] = []
  let value = 1

  for (const item of items) {
    const text = decodeHtmlEntities(item.textContent.trim())
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
      } as SerializedLexicalNode)
    }
  }

  if (listItems.length === 0) return null

  return {
    type: 'list',
    listType: isOrdered ? 'number' : 'bullet',
    start: 1,
    tag: isOrdered ? 'ol' : 'ul',
    children: listItems,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  } as SerializedLexicalNode
}

/**
 * Convert HTML to Lexical editor state with table and list support
 */
function htmlToLexical(html: string): SerializedEditorState {
  const cleanedHtml = cleanWordPressHtml(html)
  const children: SerializedLexicalNode[] = []

  // Split content by tables and lists first
  const segments = cleanedHtml.split(/(<table[\s\S]*?<\/table>|<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/gi)

  for (const segment of segments) {
    if (!segment.trim()) continue

    // Check if this segment is a table
    if (segment.toLowerCase().startsWith('<table')) {
      const tableNode = parseHtmlTable(segment)
      if (tableNode) {
        children.push(tableNode)
      }
      continue
    }

    // Check if this segment is an unordered list
    if (segment.toLowerCase().startsWith('<ul')) {
      const listNode = parseHtmlList(segment, false)
      if (listNode) {
        children.push(listNode)
      }
      continue
    }

    // Check if this segment is an ordered list
    if (segment.toLowerCase().startsWith('<ol')) {
      const listNode = parseHtmlList(segment, true)
      if (listNode) {
        children.push(listNode)
      }
      continue
    }

    // Process non-table/list content: split by block elements
    const blocks = segment
      .split(/<\/(?:p|h[1-6]|div)>/i)
      .map(block => block.trim())
      .filter(block => block.length > 0)

    for (const block of blocks) {
      // Extract heading level if present
      const headingMatch = block.match(/<h([1-6])[^>]*>([\s\S]*)/i)
      if (headingMatch) {
        const level = parseInt(headingMatch[1])
        const text = decodeHtmlEntities(headingMatch[2].replace(/<[^>]+>/g, '').trim())
        if (text) {
          children.push({
            type: 'heading',
            tag: `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
            children: [{ type: 'text', text, version: 1 }],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          } as SerializedLexicalNode)
        }
        continue
      }

      // Handle paragraphs
      const paragraphMatch = block.match(/<p[^>]*>([\s\S]*)/i)
      if (paragraphMatch) {
        const text = decodeHtmlEntities(paragraphMatch[1].replace(/<[^>]+>/g, '').trim())
        if (text) {
          children.push({
            type: 'paragraph',
            children: [{ type: 'text', text, version: 1 }],
            direction: 'ltr',
            format: '',
            indent: 0,
            textFormat: 0,
            version: 1,
          } as SerializedLexicalNode)
        }
        continue
      }

      // Fallback: treat as paragraph (skip if it looks like list remnants)
      const text = decodeHtmlEntities(block.replace(/<[^>]+>/g, '').trim())
      if (text && !block.includes('<li')) {
        children.push({
          type: 'paragraph',
          children: [{ type: 'text', text, version: 1 }],
          direction: 'ltr',
          format: '',
          indent: 0,
          textFormat: 0,
          version: 1,
        } as SerializedLexicalNode)
      }
    }
  }

  // If no content was parsed, add a placeholder
  if (children.length === 0) {
    children.push({
      type: 'paragraph',
      children: [{ type: 'text', text: '[Content conversion needed]', version: 1 }],
      direction: 'ltr',
      format: '',
      indent: 0,
      textFormat: 0,
      version: 1,
    } as SerializedLexicalNode)
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
 * Download and upload image to Payload
 */
async function uploadImage(
  payload: Awaited<ReturnType<typeof getPayload>>,
  imageUrl: string,
  altText: string
): Promise<number | null> {
  try {
    console.log(`  Downloading image: ${imageUrl}`)

    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error(`  Failed to download image: ${response.status}`)
      return null
    }

    const buffer = await response.arrayBuffer()
    const filename = imageUrl.split('/').pop() || 'image.jpg'

    // Create media in Payload
    const media = await payload.create({
      collection: 'media',
      data: {
        alt: altText || filename,
      },
      file: {
        data: Buffer.from(buffer),
        name: filename,
        mimetype: response.headers.get('content-type') || 'image/jpeg',
        size: buffer.byteLength,
      },
    })

    console.log(`  Uploaded image: ${media.id}`)
    return media.id
  } catch (error) {
    console.error('  Error uploading image:', error)
    return null
  }
}

/**
 * Main migration function
 */
async function migratePost(postSlug: string, isDryRun: boolean) {
  console.log(`\n🔄 Migrating WordPress post: ${postSlug}`)
  console.log(isDryRun ? '   (DRY RUN - no changes will be made)\n' : '\n')

  // Step 1: Fetch from WordPress
  console.log('1. Fetching from WordPress...')
  const wpPost = await fetchWordPressPost(postSlug)

  if (!wpPost) {
    console.error(`❌ Post not found: ${postSlug}`)
    process.exit(1)
  }

  console.log(`   Found: "${wpPost.title}"`)
  console.log(`   Date: ${wpPost.date}`)
  console.log(`   Categories: ${wpPost.categories?.nodes.map(c => c.name).join(', ') || 'none'}`)
  console.log(`   Has featured image: ${!!wpPost.featuredImage}`)
  console.log(`   Content length: ${wpPost.content.length} chars`)

  if (isDryRun) {
    console.log('\n📋 DRY RUN - Would create post with:')
    console.log(`   Title: ${wpPost.title}`)
    console.log(`   Slug: ${wpPost.slug}`)
    console.log(`   Published: ${wpPost.date}`)
    console.log('\n✅ Dry run complete. Run without --dry-run to migrate.')
    return
  }

  // Step 2: Initialize Payload
  console.log('\n2. Connecting to Payload...')
  const payload = await getPayload({ config })
  console.log('   Connected!')

  // Step 3: Check if post already exists
  console.log('\n3. Checking for existing post...')
  const existing = await payload.find({
    collection: 'posts',
    where: { slug: { equals: wpPost.slug } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log(`   ⚠️  Post with slug "${wpPost.slug}" already exists (ID: ${existing.docs[0].id})`)
    console.log('   Skipping to avoid duplicates.')
    process.exit(0)
  }

  // Step 4: Upload featured image if present
  let heroImageId: number | null = null
  if (wpPost.featuredImage?.node?.sourceUrl) {
    console.log('\n4. Uploading featured image...')
    heroImageId = await uploadImage(
      payload,
      wpPost.featuredImage.node.sourceUrl,
      wpPost.featuredImage.node.altText
    )
  }

  // Step 5: Convert content to Lexical
  console.log('\n5. Converting content to Lexical format...')
  const lexicalContent = htmlToLexical(wpPost.content)
  console.log(`   Created ${lexicalContent.root.children.length} content blocks`)

  // Step 6: Create post in Payload
  console.log('\n6. Creating post in Payload...')

  const post = await payload.create({
    collection: 'posts',
    data: {
      title: wpPost.title,
      slug: wpPost.slug,
      content: lexicalContent,
      heroImage: heroImageId || undefined,
      publishedAt: wpPost.date,
      _status: 'draft', // Import as draft for review
      meta: {
        title: wpPost.title,
        description: wpPost.excerpt?.replace(/<[^>]+>/g, '').slice(0, 160) || undefined,
      },
    },
  })

  console.log(`\n✅ Successfully migrated!`)
  console.log(`   Payload Post ID: ${post.id}`)
  console.log(`   View in admin: http://localhost:3000/admin/collections/posts/${post.id}`)
}

// Run the migration
migratePost(slug, dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
