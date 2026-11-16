import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'generated/**', 'native/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain Node scripts are not covered by the TypeScript config, so declare the Node globals they use. They are command
    // line tools, so printing to the console is their job.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        performance: 'readonly',
        WebSocket: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The project rule: no `any` without a written reason (a disable comment with the reason).
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
    },
  },
  // After the general rules, so it wins: command line scripts print to the console.
  { files: ['scripts/**/*.mjs'], rules: { 'no-console': 'off' } },
);
