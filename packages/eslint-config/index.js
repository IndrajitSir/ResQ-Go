/**
 * Shared ESLint configuration for ResQ-Go workspaces.
 *
 * Written in the legacy `.eslintrc` format because that is what the Next.js 14
 * toolchain consumes (`next lint`, `eslint-config-next`, ESLint 8). An earlier
 * version of this package declared flat config and an ESLint 9 peer, which
 * could not be satisfied alongside Next 14 and made dependency resolution fail.
 *
 * Formatting is deliberately not enforced here; correctness rules only.
 */
module.exports = {
  root: false,
  // `next/typescript` registers the TypeScript ESLint plugin, which the
  // rules below depend on.
  extends: ['next/core-web-vitals', 'next/typescript'],
  rules: {
    // Console output is used deliberately for structured operational logging.
    'no-console': 'off',
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'no-var': 'error',
    // Unused arguments prefixed with `_` are intentional (signature stability).
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  overrides: [
    {
      // Config files are CommonJS by design.
      files: ['*.js', '*.cjs'],
      rules: { '@typescript-eslint/no-unused-vars': 'off' },
    },
  ],
};
