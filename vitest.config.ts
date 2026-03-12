import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
    },
    resolve: {
        alias: {
            'obsidian': '__mocks__/obsidian.ts',
        }
    }
});