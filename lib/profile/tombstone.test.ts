import { describe, expect, it } from 'vitest'

import type { Profile } from '@/lib/data/types'

import {
  TOMBSTONE_FIELDS,
  filledFields,
  hasAnythingToReuse,
  reuseDisclosure,
} from './tombstone'

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    fullName: null,
    email: null,
    role: null,
    department: null,
    institution: 'Dalhousie University',
    coreCertificateStatus: null,
    coreCertificateDate: null,
    phone: null,
    updatedAt: '2026-08-05T12:00:00.000Z',
    ...overrides,
  }
}

describe('what counts as something to reuse', () => {
  it('finds nothing in an empty profile beyond the institution default', () => {
    expect(filledFields(profile()).map((field) => field.label)).toEqual(['Institution'])
  })

  it('finds nothing at all when there is no profile', () => {
    expect(filledFields(null)).toEqual([])
    expect(hasAnythingToReuse(null)).toBe(false)
  })

  it('ignores fields holding only whitespace', () => {
    const fields = filledFields(profile({ fullName: '   ', department: 'Engineering' }))
    expect(fields.map((field) => field.label)).not.toContain('Full name')
    expect(fields.map((field) => field.label)).toContain('Department or faculty')
  })

  it('lists filled fields in the order they are asked for', () => {
    const fields = filledFields(
      profile({ fullName: 'A Researcher', role: 'Principal Investigator', phone: '902-555-0100' }),
    )
    const order = TOMBSTONE_FIELDS.map((field) => field.label)
    const positions = fields.map((field) => order.indexOf(field.label))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})

describe('the disclosure shown at the moment of confirming', () => {
  const filled = profile({
    fullName: 'A Researcher',
    role: 'Principal Investigator',
    department: 'Engineering',
  })

  it('names every value that would be carried over, so the researcher sees the actual data', () => {
    const text = reuseDisclosure(filled)
    expect(text).toContain('A Researcher')
    expect(text).toContain('Principal Investigator')
    expect(text).toContain('Engineering')
  })

  it('says plainly that no participant information is involved', () => {
    expect(reuseDisclosure(filled)).toMatch(/No participant information is stored/i)
  })

  it('says declining is possible', () => {
    expect(reuseDisclosure(filled)).toMatch(/can decline/i)
  })

  it('says the decision is recorded', () => {
    expect(reuseDisclosure(filled)).toMatch(/recorded against this application/i)
  })

  it('never claims something is carried over that is not filled in', () => {
    // The record stores this text verbatim, so a disclosure listing a field the
    // researcher never entered would be a false record of what they agreed to.
    const text = reuseDisclosure(filled)
    expect(text).not.toContain('Contact phone')
    expect(text).not.toContain('Date completed')
  })
})
