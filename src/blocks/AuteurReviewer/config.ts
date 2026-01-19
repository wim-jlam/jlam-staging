import type { Block } from 'payload'

/**
 * AuteurReviewer Block
 * Shows author and reviewer information with beige/pink background
 * Used at the top of medical content for credibility
 */
export const AuteurReviewer: Block = {
  slug: 'auteurReviewer',
  labels: {
    singular: 'Auteur/Reviewer',
    plural: 'Auteur/Reviewer blokken',
  },
  fields: [
    {
      name: 'auteur',
      type: 'text',
      label: 'Auteur',
      required: true,
    },
    {
      name: 'reviewer',
      type: 'text',
      label: 'Reviewer',
      required: false,
    },
    {
      name: 'reviewerTitel',
      type: 'text',
      label: 'Titel/functie reviewer',
      required: false,
      admin: {
        placeholder: 'bijv. orthopedisch chirurg',
      },
    },
  ],
  interfaceName: 'AuteurReviewerBlock',
}
