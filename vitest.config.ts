import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['./tests/setup.ts'],
        environment: 'node',
    },
        environment: 'node',
        alias: {
            'obsidian': '/src/tests/mocks/obsidian.ts'
        }
    }
});
