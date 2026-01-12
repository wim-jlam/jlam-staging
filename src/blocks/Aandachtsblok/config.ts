import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

/**
 * Aandachtsblok - JLAM callout block
 * Green background (#ebf6df) with left border (#ABC98A)
 * Used for important tips, notes, and highlights
 */
export const Aandachtsblok: Block = {
  slug: 'aandachtsblok',
  labels: {
    singular: 'Aandachtsblok',
    plural: 'Aandachtsblokken',
  },
  fields: [
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
      label: false,
      required: true,
    },
  ],
  interfaceName: 'AandachtsblokBlock',
}
