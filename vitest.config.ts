import { defineConfig } from 'vitest/config';

// Config separata da vite.config.ts: i test unitari sono funzioni pure,
// non serve caricare React/PWA. Ambiente Node, niente plugin.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
