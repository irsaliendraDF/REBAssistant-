import { getSession } from '@/lib/auth/session'
import { getStore } from '@/lib/data'
import { assembleDraft } from '@/lib/draft/assemble'
import { renderDocx } from '@/lib/draft/docx'

/**
 * Downloads the working draft as a Word document.
 *
 * Available from intake onwards rather than only at the end, because a partial
 * document that shows the real structure is the fastest way to find out whether
 * the structure is right. The document labels every undrafted section, so an
 * early download cannot be mistaken for a finished application.
 */
export async function GET(request: Request, ctx: RouteContext<'/project/[id]/export'>) {
  const { id } = await ctx.params

  const session = await getSession()
  if (!session) {
    return new Response('Not signed in', { status: 401 })
  }

  const store = getStore()
  const project = await store.getProject(id, session.userId)
  if (!project) {
    return new Response('Not found', { status: 404 })
  }

  const answers = await store.getAnswers(id)
  const draft = assembleDraft({ project, answers })
  const file = await renderDocx(draft)

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename(project.title)}"`,
      // A draft reflects answers as they stood at download. Never cache it.
      'Cache-Control': 'no-store',
    },
  })
}

function filename(title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'application'

  return `${slug}-research-ethics-board-draft.docx`
}
