'use server'

import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import { APP_TERMS_DISCLOSURE, DISCLOSURE_VERSION } from '@/lib/disclosure/text'

/**
 * Guardrail 8, surface (a). Recorded once per person rather than per
 * application, with the wording stored verbatim: a record that only says
 * "accepted v3" is worthless once v3 is gone.
 */
export async function acceptAppTerms() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const store = getStore()
  await store.recordConsent({
    userId: session.userId,
    projectId: null,
    kind: 'app_terms',
    granted: true,
    disclosureText: APP_TERMS_DISCLOSURE,
    scope: null,
    consentVersion: DISCLOSURE_VERSION,
  })

  redirect('/dashboard')
}

/**
 * Starting an application creates the project and drops the researcher into
 * triage, which is the first state and the only one a new project can be in.
 */
export async function createProject() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const store = getStore()

  // The terms gate is a screen, and a screen can be skipped by posting straight
  // to this action. Checked here too, so the gate is a rule rather than a layout
  // choice.
  if (!(await store.hasUserConsent(session.userId, 'app_terms'))) {
    redirect('/dashboard')
  }

  const project = await store.createProject({
    ownerId: session.userId,
    // Named in the first triage question. Until then it needs something to be
    // listed under.
    title: 'Untitled application',
  })

  redirect(`/project/${project.id}`)
}
