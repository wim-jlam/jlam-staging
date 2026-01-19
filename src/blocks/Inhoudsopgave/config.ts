import type { Block } from 'payload'

/**
 * Inhoudsopgave Block
 * Table of Contents - automatically generated from page headings
 * Beige/pink background matching JLAM style
 */
export const Inhoudsopgave: Block = {
  slug: 'inhoudsopgave',
  labels: {
    singular: 'Inhoudsopgave',
    plural: 'Inhoudsopgaven',
  },
  fields: [
    {
      name: 'titel',
      type: 'text',
      label: 'Titel',
      defaultValue: 'Inhoudsopgave',
    },
    {
      name: 'autoGenerate',
      type: 'checkbox',
      label: 'Automatisch genereren uit headings',
      defaultValue: true,
      admin: {
        description: 'Haalt automatisch alle H2 headings op uit de pagina content',
      },
    },
    {
      name: 'items',
      type: 'array',
      label: 'Handmatige items (alleen als auto uit staat)',
      admin: {
        condition: (data, siblingData) => !siblingData?.autoGenerate,
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Tekst',
          required: true,
        },
        {
          name: 'anchor',
          type: 'text',
          label: 'Anchor (heading ID)',
          required: false,
        },
      ],
    },
  ],
  interfaceName: 'InhoudsopgaveBlock',
}
