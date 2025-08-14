// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import jsonPlugin from '@eslint/json';
import markdownPlugin from '@eslint/markdown';

export default [
  // JavaScript & Node files
  {
    ...js.configs.recommended, // pulls in the recommended rules
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        ecmaVersion: 'latest',
        sourceType: 'module',
        babelOptions: {
          plugins: [
            [
              '@babel/plugin-syntax-import-attributes',
              { deprecatedAssertSyntax: true },
            ],
          ],
        },
        globals: {
          ...globals.node,
          console: 'readonly',
        },
      },
    },
    rules: {
      'no-console': 'off', // example override
    },
  },

  // JSON files
  {
    ...jsonPlugin.configs.recommended,
    files: ['**/*.json'],
    language: 'json/json',
  },

  // JSONC files
  {
    ...jsonPlugin.configs.recommended,
    files: ['**/*.jsonc'],
    language: 'json/jsonc',
  },

  // JSON5 files
  {
    ...jsonPlugin.configs.recommended,
    files: ['**/*.json5'],
    language: 'json/json5',
  },

  // Markdown files
  {
    ...markdownPlugin.configs.recommended,
    files: ['**/*.md'],
    language: 'markdown/gfm',
  },
];
