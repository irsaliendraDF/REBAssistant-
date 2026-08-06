import { resolve } from 'node:path'

/**
 * Config for running ingestion outside Next. Two aliases are all it takes: the
 * `@` root the app uses, and a stub for `server-only`, which throws when it is
 * imported anywhere other than a server component.
 */
export default {
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '..'),
      'server-only': resolve(import.meta.dirname, 'server-only-stub.ts'),
    },
  },
}
