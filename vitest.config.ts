import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['./tests/setup.ts'],
        environment: 'node'
    },
    resolve: {
        alias: {
            'obsidian': './tests/mocks/obsidian.ts'
        }
    }
});
