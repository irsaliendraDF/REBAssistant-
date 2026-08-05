'use server'

import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'

/**
 * Starting an application creates the project and drops the researcher into
 * triage, which is the first state and the only one a new project can be in.
 */
export async function createProject() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const store = getStore()
  const project = await store.createProject({
    ownerId: session.userId,
    // Named in the first triage question. Until then it needs something to be
    // listed under.
    title: 'Untitled application',
  })

  redirect(`/project/${project.id}`)
}
