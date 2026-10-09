import {FlatCompat} from '@eslint/eslintrc'
import {fileURLToPath} from 'node:url'
import babelParser from '@babel/eslint-parser'
import globals from 'globals'

const files = ['**/*.{js,mjs,cjs}']
const compat = new FlatCompat({baseDirectory: fileURLToPath(new URL('.', import.meta.url))})

export default [
    {
        ignores: ['**/node_modules/**', 'core/**', 'build/**', '.rpt2_cache/**', '**/.*']
    },
    ...compat.extends('standard', 'standard-react').map(config => ({...config, files})),
    {
        files,
        languageOptions: {
            parser: babelParser,
            ecmaVersion: 2021,
            sourceType: 'module',
            parserOptions: {ecmaFeatures: {jsx: true}},
            globals: {
                ...globals.es2021,
                ...globals.node,
                document: 'readonly',
                navigator: 'readonly',
                window: 'readonly'
            }
        },
        linterOptions: {reportUnusedDisableDirectives: 'off'},
        settings: {react: {version: 'detect'}},
        rules: {
            // Don't force ES6 functions to include a space before parentheses.
            'space-before-function-paren': 'off',
            // Allow specifying true explicitly for boolean props.
            'react/jsx-boolean-value': 'off'
        }
    },
    {
        files: [
            'src/**/*.{js,mjs,cjs}',
            'auth/src/**/*.{js,mjs,cjs}', 'auth/build.mjs',
            'messaging/src/**/*.{js,mjs,cjs}', 'messaging/build.mjs',
            'storage/src/**/*.{js,mjs,cjs}', 'storage/build.mjs',
            '_common/src/**/*.{js,mjs,cjs}'
        ],
        languageOptions: {globals: globals.jest},
        rules: {
            "comma-dangle": [0],
            "indent": ["error", 4, {"SwitchCase": 1}],
            "no-throw-literal": [1],
            "object-curly-spacing": [0],
            "operator-linebreak": [1],
            "quotes": ["error", "double"],
            "react/jsx-closing-bracket-location": [1],
            "react/jsx-closing-tag-location": [1],
            "react/jsx-curly-brace-presence": [0],
            "react/jsx-indent-props": [1, 4],
            "react/jsx-indent": [1, 4],
            "react/jsx-tag-spacing": [0],
            "semi": [0]
        }
    }
]
