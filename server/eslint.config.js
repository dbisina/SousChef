import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'generated/**', 'native/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain Node scripts are not covered by the TypeScript config, so declare the Node global they use.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The project rule: no `any` without a written reason (a disable comment with the reason).
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'error',
    },
  },
);
