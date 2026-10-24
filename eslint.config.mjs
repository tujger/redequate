import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import babelParser from '@babel/eslint-parser'
import globals from 'globals'

const files = ['**/*.{js,mjs,cjs,ts}']
const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL('.', import.meta.url)) })

export default [
  {
    ignores: ['**/node_modules/**', 'core/**', 'build/**', 'packages/server/dist/**', '.rpt2_cache/**', '**/.*']
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
      'packages/_common/src/**/*.{js,mjs,cjs}'
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
  }

]
