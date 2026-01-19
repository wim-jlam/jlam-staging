/**
 * Extract headings from Lexical content and generate IDs
 */

export interface TocItem {
  id: string
  text: string
  level: number
}

/**
 * Generate a URL-safe ID from text
 */
export function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Trim hyphens from start/end
}

/**
 * Extract text from Lexical node recursively
 */
function extractTextFromNode(node: any): string {
  if (node.text) return node.text
  if (!node.children) return ''
  return node.children.map(extractTextFromNode).join('')
}

/**
 * Extract headings from a Lexical richText state
 */
export function extractHeadingsFromLexical(richText: any): TocItem[] {
  const headings: TocItem[] = []

  if (!richText?.root?.children) return headings

  for (const node of richText.root.children) {
    if (node.type === 'heading') {
      const text = extractTextFromNode(node).trim()
      if (text) {
        const level = parseInt(node.tag?.replace('h', '') || '2', 10)
        headings.push({
          id: generateHeadingId(text),
          text,
          level,
        })
      }
    }
  }

  return headings
}

/**
 * Extract headings from all content blocks in a page layout
 */
export function extractHeadingsFromLayout(layout: any[]): TocItem[] {
  const headings: TocItem[] = []

  if (!layout) return headings

  for (const block of layout) {
    if (block.blockType === 'content' && block.columns) {
      for (const column of block.columns) {
        if (column.richText) {
          headings.push(...extractHeadingsFromLexical(column.richText))
        }
      }
    }
  }

  return headings
}
