'use server'

import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import { TOMBSTONE_FIELDS } from '@/lib/profile/tombstone'
import type { ProfileInput } from '@/lib/data/types'

export async function saveProfile(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const input: ProfileInput = {}
  for (const field of TOMBSTONE_FIELDS) {
    const value = formData.get(String(field.key))
    if (value === null) continue
    const trimmed = String(value).trim()
    // A cleared field is stored as null rather than an empty string, so
    // "has this been filled in" is a single check everywhere else.
    ;(input as Record<string, string | null>)[String(field.key)] = trimmed.length > 0 ? trimmed : null
  }

  // The address they sign in with, kept in step so the team section of the form
  // does not disagree with the account.
  input.email = session.email || null

  const store = getStore()
  await store.upsertProfile(session.userId, input)

  redirect('/profile?saved=1')
}
