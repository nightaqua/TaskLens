import tseslint from "typescript-eslint";
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
    {
        ignores: ["main.js", "*.mjs", "node_modules/**", "**/*.json", "__mocks__/**", "vitest.config.ts"]
    },

    ...obsidianmd.configs.recommended,

    {
        files: ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
        extends: [...tseslint.configs.strictTypeChecked],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                project: ["./tsconfig.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "obsidianmd/ui/sentence-case": "warn",
            "obsidianmd/no-static-styles-assignment": "warn",
        },
    },
    {
        files: ["tests/**/*.ts", "vitest.config.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-extraneous-class": "off"
        }
    }
]);