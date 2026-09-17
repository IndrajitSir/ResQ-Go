/**
 * Shared ESLint flat config for ABS workspaces.
 * Workspaces that lint consume this via `defineConfig` / spread.
 * Kept minimal: correctness-oriented rules only (formatting is not enforced here).
 */
const config = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'no-var': 'error',
  },
};

module.exports = config;
