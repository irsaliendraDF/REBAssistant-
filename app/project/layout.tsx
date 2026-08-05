import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { getSession } from '@/lib/auth/session'

/** Auth boundary. Checked on the server before any child renders. */
export default async function ProjectLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) {
    redirect('/sign-in')
  }

  return <AppShell session={session}>{children}</AppShell>
}
