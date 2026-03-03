import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidian from "eslint-plugin-obsidianmd";

export default [
    {
        ignores: ["main.js", "*.mjs", "node_modules/**"]
    },

    js.configs.recommended,

    ...tseslint.configs.strictTypeChecked,

    {
        plugins: {
            obsidianmd: obsidian,
        },
        rules: {
            // Use strict rules manually
            ...obsidian.configs.strict?.rules,
        },
    },

    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
];