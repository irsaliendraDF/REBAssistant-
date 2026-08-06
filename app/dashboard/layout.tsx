import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'

/** Auth boundary. Checked on the server before any child renders. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect('/sign-in')
  }

  const profile = await getStore().getProfile(session.userId)

  return (
    <AppShell session={session} profileName={profile?.fullName}>
      {children}
    </AppShell>
  )
}
