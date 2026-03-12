import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/vitest.setup.ts'],
    alias: {
      'obsidian': './tests/vitest.setup.ts',
    }
  },
});
