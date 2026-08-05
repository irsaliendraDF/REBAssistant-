import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// .mts rather than .ts: the project package.json has no "type": "module", so a
// .ts config gets loaded as CommonJS and Vite warns about the ESM syntax.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
