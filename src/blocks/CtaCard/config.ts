import type { Block } from 'payload'

/**
 * CtaCard - Call-to-action card block
 * Clickable card with title, description, and link
 * Used for navigation and content promotion
 */
export const CtaCard: Block = {
  slug: 'ctaCard',
  labels: {
    singular: 'CTA Card',
    plural: 'CTA Cards',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
    },
    {
      name: 'link',
      type: 'group',
      fields: [
        {
          name: 'type',
          type: 'radio',
          defaultValue: 'reference',
          options: [
            { label: 'Internal Link', value: 'reference' },
            { label: 'Custom URL', value: 'custom' },
          ],
        },
        {
          name: 'reference',
          type: 'relationship',
          relationTo: ['posts', 'pages'],
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'reference',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'custom',
          },
        },
        {
          name: 'newTab',
          type: 'checkbox',
          label: 'Open in new tab',
        },
      ],
    },
    {
      name: 'ctaText',
      type: 'text',
      defaultValue: 'Lees meer',
      label: 'Button text',
    },
  ],
  interfaceName: 'CtaCardBlock',
}
