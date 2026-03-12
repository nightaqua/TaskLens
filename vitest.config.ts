import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        alias: {
            'obsidian': '/src/tests/mocks/obsidian.ts'
        }
    }
});