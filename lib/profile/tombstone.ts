import type { Profile } from '@/lib/data/types'

/**
 * Tombstone data, and the consent that governs reusing it.
 *
 * The promise in the deck is that a researcher enters their details once and the
 * tool reuses them on the next application. Guardrail 7 attaches a condition to
 * that promise: wherever the app stores or reuses a person's information, there
 * is an explicit consent step and a record that it happened.
 *
 * The interaction is settled in Section 9 of the build plan. Not a click on
 * every screen, and not a silent one-time consent buried at save. When a saved
 * profile is pulled into a new project, the researcher sees exactly what is
 * being carried over, confirms it, and the confirmation is recorded against that
 * project. Once per project.
 *
 * Note what is being consented to here: reuse of the researcher's own details,
 * by the researcher. It is a light-touch case. The reason it is built properly
 * anyway is that guardrail 7 is a whole-tool rule, and the honest way to hold a
 * whole-tool rule is to apply it where it is easy as well as where it is hard.
 */

export const TOMBSTONE_CONSENT_VERSION = 'tombstone-reuse-2026-08'

export interface TombstoneField {
  key: keyof Profile
  label: string
  help?: string
  type: 'text' | 'date'
}

export const TOMBSTONE_FIELDS: TombstoneField[] = [
  { key: 'fullName', label: 'Full name', type: 'text' },
  {
    key: 'affiliation',
    label: 'Your affiliation with Dalhousie',
    help: 'Section 1.1 of the form asks for this. For example Faculty, PhD Student, Master’s Student, Postdoctoral Fellow, or Staff.',
    type: 'text',
  },
  {
    key: 'role',
    label: 'Role on research projects',
    help: 'For example Lead Researcher, Co-Investigator, or Contact Person.',
    type: 'text',
  },
  { key: 'department', label: 'Department or faculty', type: 'text' },
  { key: 'institution', label: 'Institution', type: 'text' },
  {
    key: 'bannerNumber',
    label: 'Banner number',
    help: 'Required in section 1.1. The Board will not accept a submission without it.',
    type: 'text',
  },
  {
    key: 'coreCertificateStatus',
    label: 'TCPS 2: CORE tutorial',
    help: 'The Boards asks whether you have completed it. For example "Completed" or "In progress".',
    type: 'text',
  },
  { key: 'coreCertificateDate', label: 'Date completed', type: 'date' },
  {
    key: 'phone',
    label: 'Contact phone',
    help: 'Appears in the team information section of the form. Optional.',
    type: 'text',
  },
]

/** Fields with something in them. Nothing to reuse means nothing to ask about. */
export function filledFields(profile: Profile | null): { label: string; value: string }[] {
  if (!profile) return []

  return TOMBSTONE_FIELDS.map((field) => {
    const value = profile[field.key]
    if (typeof value !== 'string' || value.trim().length === 0) return null
    return { label: field.label, value: value.trim() }
  }).filter((entry): entry is { label: string; value: string } => entry !== null)
}

export function hasAnythingToReuse(profile: Profile | null): boolean {
  return filledFields(profile).length > 0
}

/**
 * The exact wording shown at the moment of confirming, stored verbatim on the
 * consent record. Storing the text rather than a version number alone means the
 * record can be reconstructed later even if this file changes.
 */
export function reuseDisclosure(profile: Profile | null): string {
  const fields = filledFields(profile)

  return [
    'Research Ethics Board Assistant has saved details from your earlier work and can carry them',
    'into this application so you do not have to type them again.',
    '',
    'What would be carried over:',
    ...fields.map((field) => `- ${field.label}: ${field.value}`),
    '',
    'These are your own details as a researcher. No participant information is stored by this tool',
    'or carried between applications. You can decline and fill this application in from scratch, and',
    'you can change your saved details at any time.',
    '',
    'Your decision is recorded against this application.',
  ].join('\n')
}
