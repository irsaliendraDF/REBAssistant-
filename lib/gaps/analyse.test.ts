import { describe, expect, it } from 'vitest'

import type { AnswerMap, Project } from '@/lib/data/types'

import { analyseGaps, countBySeverity } from './analyse'

const NOW = new Date('2026-08-05T12:00:00.000Z').toISOString()

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    ownerId: 'u1',
    title: 'Community Retrofit Readiness',
    plainLanguageSummary: null,
    institution: 'Dalhousie University',
    state: 'gap_analysis',
    involvesIndigenousResearch: false,
    involvesCommunityEngagedResearch: false,
    routingNote: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

/**
 * A complete application with answers of realistic length, so individual rules
 * can be tested in isolation without the brevity check firing on everything.
 */
const COMPLETE: AnswerMap = {
  'intake.2_2.question':
    'What blocks retrofit uptake among rural homeowners in Nova Scotia at the point where funding has been secured but work has not started?',
  'intake.2_3.who':
    'Homeowners in rural Nova Scotia who have considered a heat pump installation in the last two years, recruited across three municipalities of differing size.',
  'intake.2_3.dependence': 'no',
  'intake.2_4.how':
    'Posters in community centres, a notice in each municipal newsletter, and an invitation shared by two local energy co-operatives to their mailing lists.',
  'intake.2_5.how': 'written',
  'intake.2_5.withdrawal':
    'Participants may stop at any time and may ask for their transcript to be removed up until results are aggregated, three months after their interview.',
  'intake.2_6.what_happens':
    'One semi-structured interview of about forty five minutes, held in the participant home or by video call, followed by an optional short follow-up email.',
  'intake.2_6.recording': 'no',
  'intake.2_6.intervention': 'no',
  'intake.2_7.identifiability': 'coded',
  'intake.2_7.storage':
    'On an encrypted university drive that only the named research team can reach, with the linking key held separately by the principal investigator.',
  'intake.2_7.outside_canada': 'no',
  'intake.2_7.health_information': 'no',
  'intake.2_8.how_long':
    'Five years following publication, after which recordings, transcripts and the linking key are deleted and deletion is confirmed in writing.',
  'intake.2_9.risks':
    'Some discomfort may arise when discussing household finances with a stranger, and a small risk of identification in a small community.',
  'intake.2_9.mitigation':
    'Participants are told in advance that any question can be skipped, and identifying details of place are generalised in all reporting.',
  'intake.2_10.where':
    'A public report for each participating municipality, a peer reviewed conference paper, and a plain language summary sent to participants.',
}

function sectionsFlagged(findings: { formSection: string | null }[]): string[] {
  return findings.map((finding) => finding.formSection ?? '')
}

describe('missing sections', () => {
  it('flags a section whose required questions are unanswered', () => {
    const findings = analyseGaps(project(), {})
    expect(findings.some((finding) => finding.severity === 'missing')).toBe(true)
  })

  it('raises nothing about completeness once everything required is answered', () => {
    const findings = analyseGaps(project(), COMPLETE)
    expect(findings.filter((finding) => finding.severity === 'missing')).toEqual([])
  })
})

describe('contradictions, which are the findings worth having', () => {
  it('catches anonymous data that is also being recorded', () => {
    const findings = analyseGaps(project(), {
      ...COMPLETE,
      'intake.2_7.identifiability': 'anonymous',
      'intake.2_6.recording': 'yes',
    })
    expect(findings.some((finding) => /recording is identifiable/i.test(finding.finding))).toBe(true)
  })

  it('catches anonymous data that participants are told they can withdraw', () => {
    const findings = analyseGaps(project(), {
      ...COMPLETE,
      'intake.2_7.identifiability': 'anonymous',
      'intake.2_5.withdrawal': 'Participants can withdraw and have their data deleted at any point.',
    })
    expect(findings.some((finding) => /no way to find and remove it/i.test(finding.finding))).toBe(
      true,
    )
  })

  it('raises undue influence when participants may be in a dependent relationship', () => {
    const findings = analyseGaps(project(), { ...COMPLETE, 'intake.2_3.dependence': 'yes' })
    expect(findings.some((finding) => /undue influence/i.test(finding.finding))).toBe(true)
  })

  it('treats "I am not sure" about dependence the same as yes', () => {
    const findings = analyseGaps(project(), { ...COMPLETE, 'intake.2_3.dependence': 'unsure' })
    expect(findings.some((finding) => /undue influence/i.test(finding.finding))).toBe(true)
  })

  it('raises the confidentiality agreement when sessions are recorded', () => {
    const findings = analyseGaps(project(), { ...COMPLETE, 'intake.2_6.recording': 'yes' })
    expect(findings.some((finding) => /2\.6\.3/.test(finding.finding))).toBe(true)
  })

  it.each(['yes', 'unsure'])('raises data residency when the answer is %s', (value) => {
    const findings = analyseGaps(project(), { ...COMPLETE, 'intake.2_7.outside_canada': value })
    expect(findings.some((finding) => /2\.7\.5/.test(finding.finding))).toBe(true)
  })

  it.each(['None', 'none.', 'N/A', 'no risks'])('questions a risks answer of "%s"', (value) => {
    const findings = analyseGaps(project(), { ...COMPLETE, 'intake.2_9.risks': value })
    expect(findings.some((finding) => finding.formSection === '2.9')).toBe(true)
  })

  it('does not question a real risks answer that happens to contain the word none', () => {
    const findings = analyseGaps(project(), {
      ...COMPLETE,
      'intake.2_9.risks': 'There is a risk of discomfort, though none of it is physical in nature.',
    })
    expect(findings.some((finding) => /says there are none/i.test(finding.finding))).toBe(false)
  })

  it('raises nothing spurious on a clean application', () => {
    const findings = analyseGaps(project(), COMPLETE)
    expect(findings).toEqual([])
  })

  it('still calls out a genuinely brief answer to a required question', () => {
    const findings = analyseGaps(project(), { ...COMPLETE, 'intake.2_6.what_happens': 'An interview.' })
    expect(findings.some((finding) => finding.severity === 'thin')).toBe(true)
  })

  it('leaves brief optional answers alone, so the list stays worth reading', () => {
    const findings = analyseGaps(project(), { ...COMPLETE, 'intake.2_12.conflict': 'None.' })
    expect(findings.filter((finding) => finding.severity === 'thin')).toEqual([])
  })
})

describe('guardrail 4 appears in the list the researcher works from', () => {
  it('names the Indigenous research flag', () => {
    const findings = analyseGaps(project({ involvesIndigenousResearch: true }), COMPLETE)
    expect(sectionsFlagged(findings)).toContain('2.13')
    expect(findings.some((finding) => /Chapter 9/.test(finding.tcps2Reference ?? ''))).toBe(true)
  })

  it('names the community-engaged flag', () => {
    const findings = analyseGaps(project({ involvesCommunityEngagedResearch: true }), COMPLETE)
    expect(sectionsFlagged(findings)).toContain('2.3')
  })
})

describe('guardrail 6: observations, never determinations', () => {
  it('never says an application is compliant, adequate, sufficient, approved or exempt', () => {
    const findings = analyseGaps(project({ involvesIndigenousResearch: true }), {
      ...COMPLETE,
      'intake.2_3.dependence': 'yes',
      'intake.2_7.outside_canada': 'yes',
      'intake.2_9.risks': 'None',
    })

    const text = findings.map((finding) => finding.finding).join(' ')
    expect(text).not.toMatch(
      /\b(approved|approval|compliant|non-compliant|exempt|adequate|sufficient|passes|fails)\b/i,
    )
  })

  it('cites TCPS2 only at chapter level, never inventing an article number', () => {
    // A tool that invents plausible article numbers into a research ethics
    // application is worse than one that cites nothing: the researcher cannot
    // tell the difference and the Board can. Article-level citations arrive with
    // ingestion, from the source document.
    const findings = analyseGaps(project({ involvesIndigenousResearch: true }), {
      ...COMPLETE,
      'intake.2_3.dependence': 'yes',
    })

    for (const finding of findings) {
      if (!finding.tcps2Reference) continue
      expect(finding.tcps2Reference).toMatch(/^TCPS 2, Chapter \d+:/)
      expect(finding.tcps2Reference).not.toMatch(/Article/)
    }
  })

  it('marks rule-derived findings as not AI-generated', () => {
    const findings = analyseGaps(project(), {})
    for (const finding of findings) {
      expect(finding.aiGenerated).toBe(false)
      expect(finding.modelVersion).toBeNull()
    }
  })
})

describe('ordering and counting', () => {
  it('puts incomplete sections above softer observations', () => {
    const findings = analyseGaps(project(), { 'intake.2_9.risks': 'None' })
    const firstSoft = findings.findIndex((finding) => finding.severity !== 'missing')
    const lastMissing = findings.map((f) => f.severity).lastIndexOf('missing')
    expect(lastMissing).toBeLessThan(firstSoft === -1 ? Number.MAX_SAFE_INTEGER : firstSoft)
  })

  it('counts by severity', () => {
    const counts = countBySeverity(analyseGaps(project(), {}))
    expect(counts.missing).toBeGreaterThan(0)
    expect(counts.missing + counts.worth_reviewing + counts.thin).toBe(
      analyseGaps(project(), {}).length,
    )
  })
})
