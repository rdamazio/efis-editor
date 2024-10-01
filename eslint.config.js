// @ts-check
const depend = require('eslint-plugin-depend');
const eslint = require('@eslint/js');
const angular = require('angular-eslint');
const jasmine = require('eslint-plugin-jasmine');
const nosecrets = require('eslint-plugin-no-secrets');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const promise = require('eslint-plugin-promise');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      prettierRecommended,
      depend.configs['flat/recommended'],
      promise.configs['flat/recommended'],
      jasmine.configs.recommended,
    ],
    plugins: {
      jasmine: jasmine,
      'no-secrets': nosecrets,
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      'array-callback-return': 'error',
      eqeqeq: 'error',
      'jasmine/new-line-before-expect': 'off',
      'no-await-in-loop': 'error',
      'no-constructor-return': 'error',
      'no-duplicate-imports': 'error',
      'no-implicit-coercion': 'error',
      'no-secrets/no-secrets': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-useless-assignment': 'error',
      'no-var': 'error',
      'require-atomic-updates': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility, prettierRecommended],
    rules: {
      'prettier/prettier': [
        'error',
        {
          parser: 'angular',
        },
      ],
    },
  },
);
