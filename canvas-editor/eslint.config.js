import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Pure-data stores live in src/stores/*.ts and must stay decoupled. Only
// editor-store (the project root coordinator), chat-store (a service that
// reads project context), and coordinate.ts (subscription bridge) are
// allowed to reach across stores. The rule below catches accidental
// store-to-store coupling early.
const storeCoupling = {
  files: ['src/stores/*.ts'],
  ignores: [
    'src/stores/editor-store.ts',
    'src/stores/chat-store.ts',
    'src/stores/coordinate.ts',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: [
          './editor-store',
          './chat-store',
          './history-store',
          './selection-store',
          './tool-store',
          './viewport-store',
        ],
        message: 'Pure stores must not import sibling stores. Coordinate via src/stores/coordinate.ts or src/stores/editor-store.ts.',
      }],
    }],
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  storeCoupling,
])
