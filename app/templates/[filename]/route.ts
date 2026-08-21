import { readFile } from 'node:fs/promises'

import { getSession } from '@/lib/auth/session'
import { resolveTemplate } from '@/lib/documents/templates'

/**
 * Serves a Dalhousie template from the knowledge base.
 *
 * Signed in only. These are the client's own source documents rather than
 * anything this tool wrote, and an open route would turn a research ethics
 * assistant into a public file host for material that is not ours to publish.
 *
 * `resolveTemplate` allows only filenames the manifest lists, so this route
 * cannot be talked into reading anything else out of the repository.
 */
export async function GET(request: Request, ctx: RouteContext<'/templates/[filename]'>) {
  const { filename } = await ctx.params

  const session = await getSession()
  if (!session) {
    return new Response('Not signed in', { status: 401 })
  }

  const template = await resolveTemplate(decodeURIComponent(filename))
  if (!template) {
    return new Response('That template is not available on this deployment.', { status: 404 })
  }

  const file = await readFile(template.path)

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': template.contentType,
      // Inline: a consent form template is read before it is filled in, and a
      // browser preview is a shorter path to reading it than a download is.
      'Content-Disposition': `inline; filename="${basenameFor(template.path)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

function basenameFor(path: string): string {
  return path.split(/[\\/]/).pop() ?? 'template'
}
