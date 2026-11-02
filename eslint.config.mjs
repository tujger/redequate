import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import babelParser from '@babel/eslint-parser'
import globals from 'globals'
import databaseQueries from './tooling/eslint-database-queries.mjs'
import localStores, { storesJsonParser } from './tooling/eslint-local-stores.mjs'

const files = ['**/*.{js,mjs,cjs,ts}']
const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL('.', import.meta.url)) })

export default [
  {
    ignores: ['**/node_modules/**', '**/core/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.rpt2_cache/**', '**/.cache/**', '**/.firebase/**', '**/vendor/**', '**/vendors/**', '**/external/**', '**/third_party/**', '**/third-party/**', '**/generated/**', '**/tmp/**', '**/temp/**', '**/*.min.js', '**/.*']
  },
  ...compat.extends('standard', 'standard-react').map(config => ({ ...config, files })),
  {
    files,
    languageOptions: {
      parser: babelParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true }, requireConfigFile: false },
      globals: {
        ...globals.es2021,
        ...globals.node,
        document: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
        indexedDB: 'readonly'
      }
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    settings: { react: { version: 'detect' } },
    rules: {
      // Don't force ES6 functions to include a space before parentheses.
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off',
      'space-before-function-paren': 'off',
      // Allow specifying true explicitly for boolean props.
      'react/jsx-boolean-value': 'off'
    }
  },
  {
    files: [
      'src/**/*.{js,mjs,cjs}',
      'packages/__tests__/**/*.{js,mjs,cjs}',
      'packages/auth/src/**/*.{js,mjs,cjs}', 'packages/auth/build.mjs',
      'packages/backend/src/**/*.{js,mjs,cjs}', 'packages/backend/build.mjs',
      'packages/database/src/**/*.{js,mjs,cjs,ts}', 'packages/database/build.mjs',
      'packages/server/build.mjs',
      'packages/messaging/src/**/*.{js,mjs,cjs}', 'packages/messaging/build.mjs',
      'packages/storage/src/**/*.{js,mjs,cjs}', 'packages/storage/build.mjs',
      'packages/common/src/**/*.{js,mjs,cjs}',
      'packages/_common/src/**/*.{js,mjs,cjs}',
      'tooling/__tests__/test-emulators.mjs', 'tooling/watch-redequate-server.mjs'
    ],
    languageOptions: { globals: globals.jest },
    rules: {
      'comma-dangle': [0],
      indent: ['error', 4, { SwitchCase: 1 }],
      'no-throw-literal': [1],
      'object-curly-spacing': [0],
      'operator-linebreak': [1],
      quotes: ['error', 'double'],
      'react/jsx-closing-bracket-location': [1],
      'react/jsx-closing-tag-location': [1],
      'react/jsx-curly-brace-presence': [0],
      'react/jsx-indent-props': [1, 4],
      'react/jsx-indent': [1, 4],
      'react/jsx-tag-spacing': [0],
      semi: [0]
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }]
    }
  },
  {
    files: ['src/**/*.{js,mjs,cjs,ts}', 'packages/**/*.{js,mjs,cjs,ts}'],
    ignores: ['**/__tests__/**'],
    plugins: { redequate: databaseQueries },
    rules: { 'redequate/database-queries': 'warn' }
  },
  {
    files: ['packages/database/src/local/stores.json'],
    languageOptions: { parser: storesJsonParser },
    plugins: { redequate: localStores },
    rules: { 'redequate/local-stores': 'warn' }
  }

]
