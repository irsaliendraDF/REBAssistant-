import { describe, expect, it } from 'vitest'

import { isLuhnValid, redact, redactAll, type RedactionCategory } from './redaction'

/**
 * Tests for the redaction gate.
 *
 * Guardrail 1 is contractual, and the gate is regular expressions, which is
 * exactly where quiet failures live. Two kinds of failure matter and they pull
 * in opposite directions:
 *
 *   A miss   sends identifiable participant data to a model. Contract breach.
 *   A false  deletes real methodology text, or blocks the researcher entirely.
 *   positive Researchers who hit these learn to route around the tool.
 *
 * So the false-positive cases below are not padding. They are the reason the
 * refusing detectors are checksum-tested and the address detector is case
 * sensitive.
 */

function hitCount(
  result: { hits: { category: RedactionCategory; count: number }[] },
  category: RedactionCategory,
): number {
  return result.hits.find((hit) => hit.category === category)?.count ?? 0
}

describe('redact: text that should pass untouched', () => {
  const clean = [
    'We will conduct 12 semi-structured interviews with homeowners in Nova Scotia.',
    'Participants will be recruited through community organisations in the Halifax Regional Municipality.',
    'This study follows TCPS2 Article 5.1 on privacy and confidentiality.',
    'Data will be retained for 5 years following publication, per section 2.8.',
    'The sample comprises 100 participants aged 18 to 65.',
    'Recruitment runs from January 2026 to March 2026.',
    'Interviews will last approximately 45 to 60 minutes.',
    'Participants live within a 5 minute walk down the street from the community centre.',
    'We anticipate a response rate between 20 and 30 percent.',
    'The retrofit programme covers 1 200 households across three municipalities.',
  ]

  it.each(clean)('leaves ordinary methodology text alone: %s', (text) => {
    const result = redact(text)
    expect(result.outcome).toBe('clean')
    expect(result.text).toBe(text)
    expect(result.hits).toEqual([])
  })

  it('handles empty input', () => {
    expect(redact('').outcome).toBe('clean')
    expect(redact('').text).toBe('')
  })
})

describe('redact: contact data is stripped, not refused', () => {
  it('removes an email address', () => {
    const result = redact('Contact the study team at ethics.study@dal.ca for details.')
    expect(result.outcome).toBe('redacted')
    expect(result.text).toContain('[EMAIL REMOVED]')
    expect(result.text).not.toContain('ethics.study@dal.ca')
    expect(hitCount(result, 'email')).toBe(1)
  })

  it('counts multiple emails separately', () => {
    const result = redact('Write to a@dal.ca or b@dal.ca.')
    expect(hitCount(result, 'email')).toBe(2)
  })

  it.each([
    '902-555-1234',
    '(902) 555-1234',
    '902.555.1234',
    '9025551234',
    '+1 902 555 1234',
    '1-902-555-1234',
  ])('removes a phone number written as %s', (phone) => {
    const result = redact(`Call the coordinator at ${phone} to arrange a time.`)
    expect(result.outcome).toBe('redacted')
    expect(hitCount(result, 'phone')).toBe(1)
    expect(result.text).not.toContain('555')
  })

  it.each(['B3H 4R2', 'B3H4R2', 'b3h 4r2'])('removes the postal code %s', (postal) => {
    const result = redact(`Recruitment is limited to the ${postal} area.`)
    expect(result.outcome).toBe('redacted')
    expect(hitCount(result, 'postal_code')).toBe(1)
  })

  it('removes a street address', () => {
    const result = redact('Interviews take place at 1234 Barrington Street.')
    expect(result.outcome).toBe('redacted')
    expect(hitCount(result, 'street_address')).toBe(1)
    expect(result.text).not.toContain('Barrington')
  })

  it.each(['Participant #14', 'Subject ID: P-003', 'Respondent no. 7', 'interviewee number 22'])(
    'removes the participant identifier %s',
    (identifier) => {
      const result = redact(`${identifier} described the retrofit process as confusing.`)
      expect(result.outcome).toBe('redacted')
      expect(hitCount(result, 'participant_identifier')).toBe(1)
    },
  )

  it('reports every category present in one pass', () => {
    const result = redact('Reach P-003 at a@dal.ca or 902-555-1234 in B3H 4R2.')
    expect(result.outcome).toBe('redacted')
    expect(hitCount(result, 'email')).toBe(1)
    expect(hitCount(result, 'phone')).toBe(1)
    expect(hitCount(result, 'postal_code')).toBe(1)
  })
})

describe('redact: identifiers that refuse the call outright', () => {
  it.each([
    'SIN: 046 454 286',
    'S.I.N. 046454286',
    'social insurance number 046-454-286',
  ])('refuses a labelled social insurance number: %s', (text) => {
    const result = redact(`The record shows ${text} for this person.`)
    expect(result.outcome).toBe('refused')
    expect(result.text).toBe('')
    expect(hitCount(result, 'social_insurance_number')).toBe(1)
  })

  it('refuses an unlabelled nine-digit group that passes the checksum', () => {
    // 046 454 286 is a documented test social insurance number and is Luhn-valid.
    const result = redact('Their number is 046 454 286 on file.')
    expect(result.outcome).toBe('refused')
    expect(hitCount(result, 'social_insurance_number')).toBe(1)
  })

  it.each(['health card 1234567890', 'MRN: 00123456', 'medical record number A123456'])(
    'refuses %s',
    (text) => {
      const result = redact(`Chart lists ${text}.`)
      expect(result.outcome).toBe('refused')
      expect(hitCount(result, 'health_number')).toBe(1)
    },
  )

  it.each([
    'DOB: 1985-04-12',
    'D.O.B. 12/04/1985',
    'date of birth March 3, 1990',
    'born on 1985-04-12',
  ])('refuses %s', (text) => {
    const result = redact(`Participant record, ${text}.`)
    expect(result.outcome).toBe('refused')
    expect(hitCount(result, 'date_of_birth')).toBe(1)
  })

  it('names every refusing category in the message shown to the researcher', () => {
    const result = redact('DOB: 1985-04-12 and health card 1234567890.')
    expect(result.outcome).toBe('refused')
    expect(result.refusalReason).toContain('a health card or medical record number')
    expect(result.refusalReason).toContain('a date of birth')
  })

  it('returns no text at all when refusing, so nothing can be sent by mistake', () => {
    const result = redact('Sensitive content, DOB: 1985-04-12, plus a lot of legitimate methodology.')
    expect(result.text).toBe('')
  })
})

describe('redact: the boundaries between detectors', () => {
  it('reads 902-555-1234 as a phone number, not as a social insurance number', () => {
    // The first nine digits of a ten-digit phone number match the 3-3-3 shape.
    // Misreading this would escalate a routine redaction into a blocked call.
    const result = redact('Call 902-555-1234.')
    expect(result.outcome).toBe('redacted')
    expect(hitCount(result, 'phone')).toBe(1)
    expect(hitCount(result, 'social_insurance_number')).toBe(0)
  })

  it('leaves an unlabelled nine-digit group alone when the checksum fails', () => {
    // Arbitrary numeric data, for example counts in a table, must not block work.
    const result = redact('Columns read 100 200 300 across the three sites.')
    expect(result.outcome).toBe('clean')
  })

  it('does not treat ordinary prose as a street address', () => {
    const result = redact('The site is a 5 minute walk down the street.')
    expect(result.outcome).toBe('clean')
    expect(result.text).toContain('walk down the street')
  })

  it('does not treat section numbers or year ranges as identifiers', () => {
    const result = redact('See section 2.7.5, covering 2020 to 2024.')
    expect(result.outcome).toBe('clean')
  })

  it('does not bite a chunk out of a longer numeric identifier', () => {
    const result = redact('Grant reference 1234567890123456 applies.')
    expect(result.outcome).toBe('clean')
  })
})

describe('redact: statefulness and repeat calls', () => {
  it('gives the same answer on every call, so no match is skipped by regex state', () => {
    const text = 'Email a@dal.ca and b@dal.ca.'
    const first = redact(text)
    const second = redact(text)
    const third = redact(text)
    expect(second).toEqual(first)
    expect(third).toEqual(first)
  })

  it('is idempotent: redacted output passes back through clean', () => {
    const once = redact('Reach a@dal.ca or 902-555-1234 at 1234 Barrington Street.')
    expect(once.outcome).toBe('redacted')
    const twice = redact(once.text)
    expect(twice.outcome).toBe('clean')
    expect(twice.text).toBe(once.text)
  })
})

describe('redact: the allow list', () => {
  it('lets an explicitly allowed email through untouched', () => {
    const result = redact('Principal Investigator: k.jordan@dal.ca', {
      allow: ['k.jordan@dal.ca'],
    })
    expect(result.outcome).toBe('clean')
    expect(result.text).toBe('Principal Investigator: k.jordan@dal.ca')
  })

  it('still catches everything not on the allow list', () => {
    const result = redact('Team k.jordan@dal.ca, participant p@example.com', {
      allow: ['k.jordan@dal.ca'],
    })
    expect(result.outcome).toBe('redacted')
    expect(result.text).toContain('k.jordan@dal.ca')
    expect(result.text).not.toContain('p@example.com')
    expect(hitCount(result, 'email')).toBe(1)
  })

  it('keeps allow entries distinct past ten, where one index prefixes another', () => {
    const allow = Array.from({ length: 12 }, (_, index) => `person${index}@dal.ca`)
    const text = allow.join(' and ')
    const result = redact(text, { allow })
    expect(result.outcome).toBe('clean')
    expect(result.text).toBe(text)
  })

  it('ignores blank allow entries rather than parking the whole string', () => {
    const result = redact('Contact a@dal.ca', { allow: ['', '   '] })
    expect(result.outcome).toBe('redacted')
  })
})

describe('redactAll', () => {
  it('merges counts across every string in the call', () => {
    const result = redactAll(['Email a@dal.ca', 'Email b@dal.ca', 'nothing here'])
    expect(result.outcome).toBe('redacted')
    expect(hitCount(result, 'email')).toBe(2)
    expect(result.texts).toHaveLength(3)
  })

  it('refuses the whole call when any one string refuses', () => {
    const result = redactAll(['perfectly ordinary methodology', 'DOB: 1985-04-12'])
    expect(result.outcome).toBe('refused')
    expect(result.texts).toEqual([])
    expect(result.refusalReason).toContain('a date of birth')
  })

  it('reports clean only when every string is clean', () => {
    const result = redactAll(['methodology', 'more methodology'])
    expect(result.outcome).toBe('clean')
    expect(result.texts).toEqual(['methodology', 'more methodology'])
  })
})

describe('isLuhnValid', () => {
  it.each(['046454286', '046 454 286', '046-454-286'])('accepts %s', (value) => {
    expect(isLuhnValid(value)).toBe(true)
  })

  it.each(['100200300', '123456789', ''])('rejects %s', (value) => {
    expect(isLuhnValid(value)).toBe(false)
  })
})
