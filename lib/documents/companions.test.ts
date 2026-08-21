import { describe, expect, it } from 'vitest'

import type { AnswerMap, Project } from '@/lib/data/types'

import {
  countByNecessity,
  suggestCompanionDocuments,
  templatesReferenced,
  type CompanionDocument,
} from './companions'

const NOW = new Date('2026-08-21T12:00:00.000Z').toISOString()

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    ownerId: 'u1',
    title: 'Community Retrofit Readiness',
    plainLanguageSummary: null,
    institution: 'Dalhousie University',
    state: 'complete',
    involvesIndigenousResearch: false,
    involvesCommunityEngagedResearch: false,
    routingNote: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

/** An interview study: the shape of the live test application. */
const INTERVIEW_STUDY: AnswerMap = {
  'triage.data_source': 'direct',
  'triage.plain_summary':
    'What blocks retrofit uptake among rural homeowners once funding is secured but work has not started.',
  'intake.2_3.dependence': 'no',
  'intake.2_4.third_party': 'no',
  'intake.2_4.how':
    'Posters in community centres and an invitation shared by two local energy co-operatives.',
  'intake.2_5.how': 'written',
  'intake.2_5.future_use': 'no',
  'intake.2_5.withdrawal':
    'Participants may ask for their transcript to be removed until results are aggregated.',
  'intake.2_6.what_happens': 'One semi-structured interview of about forty five minutes.',
  'intake.2_6.recording': 'no',
  'intake.2_7.outside_canada': 'no',
  'intake.2_7.health_information': 'no',
  'intake.2_7.storage': 'On an encrypted university drive.',
  'intake.2_7.retention': 'Five years following publication.',
}

function ids(documents: CompanionDocument[]): string[] {
  return documents.map((document) => document.id)
}

describe('what the answers point at', () => {
  it('asks for a consent form and recruitment materials for a study collecting data directly', () => {
    const documents = suggestCompanionDocuments(project(), INTERVIEW_STUDY)

    expect(ids(documents)).toContain('consent_form')
    expect(ids(documents)).toContain('recruitment_materials')
  })

  it('asks for an interview guide when the methods describe interviews', () => {
    const documents = suggestCompanionDocuments(project(), INTERVIEW_STUDY)
    expect(ids(documents)).toContain('interview_guide')
  })

  it('names the guide for key informants when that is what the study runs', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_6.what_happens': 'Key informant interviews with municipal energy coordinators.',
    })

    const guide = documents.find((document) => document.id === 'interview_guide')
    expect(guide?.title).toBe('Key informant interview guide')
  })

  it('asks for the survey itself when the study runs a survey', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_6.what_happens': 'A fifteen minute online questionnaire about household heating.',
    })

    expect(ids(documents)).toContain('survey_instrument')
  })

  it('asks for a focus group guide and ground rules when sessions are held in groups', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_6.what_happens': 'A ninety minute focus group with six to eight homeowners.',
    })

    expect(ids(documents)).toContain('focus_group_guide')
  })

  it('does not invent an instrument the answers never described', () => {
    const documents = suggestCompanionDocuments(project(), INTERVIEW_STUDY)

    expect(ids(documents)).not.toContain('survey_instrument')
    expect(ids(documents)).not.toContain('focus_group_guide')
    expect(ids(documents)).not.toContain('observation_protocol')
  })
})

describe('documents that follow from a single answer', () => {
  it('asks for a confidentiality agreement once anything is recorded', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_6.recording': 'yes',
    })

    const agreement = documents.find((document) => document.id === 'confidentiality_agreement')
    expect(agreement?.necessity).toBe('required')
    expect(agreement?.templateFilename).toBe('confidentiality-agreement-template.pdf')
  })

  it('treats "I am not sure" about recording as a reason to prepare the agreement', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_6.recording': 'unsure',
    })

    expect(ids(documents)).toContain('confidentiality_agreement')
  })

  it('asks for a permission letter when a third party is involved in recruitment', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_4.third_party': 'yes',
    })

    expect(ids(documents)).toContain('permission_letter')
  })

  it('asks for separate consent when the data may be kept for future research', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_5.future_use': 'yes',
    })

    const consent = documents.find((document) => document.id === 'consent_future_use')
    expect(consent?.templateFilename).toBe(
      'consent-form-data-sharing-repository-future-research.pdf',
    )
  })
})

describe('which consent template', () => {
  it('points a survey with implied consent at the online survey template', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_5.how': 'implied',
    })

    const consent = documents.find((document) => document.id === 'consent_form')
    expect(consent?.templateFilename).toBe('consent-form-template-online-survey.pdf')
  })

  it('points a study collecting data in person at the prospective research template', () => {
    const consent = suggestCompanionDocuments(project(), INTERVIEW_STUDY).find(
      (document) => document.id === 'consent_form',
    )

    expect(consent?.templateFilename).toBe('consent-form-prospective-research-data-collection.pdf')
  })

  it('points research on existing health records at the personal records template', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'triage.data_source': 'existing',
      'intake.2_7.health_information': 'yes',
    })

    const consent = documents.find((document) => document.id === 'consent_secondary')
    expect(consent?.templateFilename).toBe('consent-form-secondary-personal-records.pdf')
  })
})

describe('the consent checklist is built from this study', () => {
  it('carries the limits on confidentiality through to the consent form', () => {
    const consent = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'intake.2_7.limits': 'A legal duty to report abuse or neglect of a child.',
    }).find((document) => document.id === 'consent_form')

    expect(consent?.checklist.join(' ')).toContain('limits on confidentiality')
  })

  it('says nothing about compensation where none was described', () => {
    const consent = suggestCompanionDocuments(project(), INTERVIEW_STUDY).find(
      (document) => document.id === 'consent_form',
    )

    expect(consent?.checklist.join(' ')).not.toContain('compensation, including')
  })

  it('always ends with the contacts and the AI disclosure', () => {
    const consent = suggestCompanionDocuments(project(), INTERVIEW_STUDY).find(
      (document) => document.id === 'consent_form',
    )

    expect(consent?.checklist.at(-1)).toContain('AI assistance')
  })
})

describe('guardrail 4', () => {
  it('routes the community agreement to a person and drafts nothing for it', () => {
    const documents = suggestCompanionDocuments(
      project({ involvesIndigenousResearch: true }),
      INTERVIEW_STUDY,
    )

    const agreement = documents.find((document) => document.id === 'community_agreement')
    expect(agreement?.routedToHuman).toBe(true)
    expect(agreement?.templateFilename).toBeNull()
  })

  it('marks the consent and recruitment documents of a flagged project as not ours to draft', () => {
    const documents = suggestCompanionDocuments(
      project({ involvesCommunityEngagedResearch: true }),
      INTERVIEW_STUDY,
    )

    const consent = documents.find((document) => document.id === 'consent_form')
    expect(consent?.routedToHuman).toBe(true)
  })

  it('leaves the documents of an unflagged project unrouted', () => {
    const documents = suggestCompanionDocuments(project(), INTERVIEW_STUDY)
    expect(documents.every((document) => document.routedToHuman === false)).toBe(true)
  })
})

describe('ordering and counting', () => {
  it('puts what the Board expects before what is worth considering', () => {
    const documents = suggestCompanionDocuments(project(), INTERVIEW_STUDY)
    const order = documents.map((document) => document.necessity)
    const firstConsider = order.indexOf('consider')

    if (firstConsider !== -1) {
      expect(order.slice(firstConsider).every((necessity) => necessity === 'consider')).toBe(true)
    }
    expect(order[0]).toBe('required')
  })

  it('counts by necessity', () => {
    const documents = suggestCompanionDocuments(project(), INTERVIEW_STUDY)
    const counts = countByNecessity(documents)

    expect(counts.required + counts.likely + counts.consider).toBe(documents.length)
  })

  it('lists each referenced template once', () => {
    const documents = suggestCompanionDocuments(project(), {
      ...INTERVIEW_STUDY,
      'triage.data_source': 'both',
    })
    const templates = templatesReferenced(documents)

    expect(new Set(templates.map((template) => template.filename)).size).toBe(templates.length)
    expect(templates.every((template) => template.label.length > 0)).toBe(true)
  })
})

describe('an application with nothing in it', () => {
  it('suggests nothing rather than guessing', () => {
    expect(suggestCompanionDocuments(project(), {})).toEqual([])
  })
})
