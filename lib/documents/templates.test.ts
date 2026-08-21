import { describe, expect, it } from 'vitest'

import { SOURCE_DIR } from '@/lib/kb/config'

/**
 * `lib/documents/templates.ts` writes the source directory out as two literal
 * path segments rather than importing `SOURCE_DIR`, because the bundler reads
 * that path statically to decide what to trace into the deployment, and a
 * constant it cannot follow makes it trace the whole project.
 *
 * That is a deliberate duplication, so it needs a test. Move the knowledge base
 * and this fails, which is the moment to update `templatePath` alongside it.
 *
 * The module itself is not imported here: it is `server-only`, and the thing
 * worth pinning is the constant, not the filesystem.
 */
describe('the template directory', () => {
  it('is the one templates.ts hard-codes', () => {
    expect(SOURCE_DIR).toBe('knowledge-base/source')
  })
})
