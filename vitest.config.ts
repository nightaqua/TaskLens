import { defineConfig } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
    test: {
        setupFiles: ['./tests/setup.ts'],
        environment: 'node'
    },
    resolve: {
        alias: {
            'obsidian': path.resolve(__dirname, './tests/mocks/obsidian.ts')
        }
    }
});
