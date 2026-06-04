// @ts-check
import tsEslint from 'typescript-eslint';
import angularEslint from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import templateParser from '@angular-eslint/template-parser';

export default tsEslint.config(
  ...tsEslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { '@angular-eslint': angularEslint },
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.spec.json'],
      },
    },
    rules: {
      ...angularEslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    plugins: { '@angular-eslint/template': angularTemplate },
    languageOptions: { parser: templateParser },
    rules: { ...angularTemplate.configs.recommended.rules },
  },
  {
    ignores: ['.angular/**', 'dist/**', 'node_modules/**', 'src/types/**'],
  },
);
