import 'server-only'

import { headers } from 'next/headers'

import { env } from './env'

/**
 * Where this request actually came from.
 *
 * Magic links need an absolute URL to send people back to, and taking that from
 * a NEXT_PUBLIC_APP_URL variable is fragile in exactly the way that matters:
 * forget to set it on the deployment and the variable quietly keeps its
 * development default, so every sign-in email sent from production points at
 * localhost. Nothing errors. It just does not work, for everyone, silently.
 *
 * Reading the request headers cannot drift, because it is derived from the URL
 * the researcher is already on. Vercel sets the forwarded headers; locally the
 * host header is enough. The environment variable stays as a last resort for
 * contexts with no request, such as a script.
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers()

  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (!host) return env.app.url.replace(/\/+$/, '')

  const forwardedProtocol = headerList.get('x-forwarded-proto')
  const protocol =
    forwardedProtocol ?? (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? 'http' : 'https')

  return `${protocol}://${host}`
}
