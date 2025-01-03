const nx = require('@nx/eslint-plugin');
const eslintPluginImport = require('eslint-plugin-import');
const jestPluginImport = require('eslint-plugin-jest');
const jestFormattingPluginImport = require('eslint-plugin-jest-formatting');
const jestAsyncPluginImport = require('eslint-plugin-jest-async');
const jestDomPluginImport = require('eslint-plugin-jest-dom');

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      importPlugin: eslintPluginImport,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['*.spec.ts', '*.spec.tsx', '*.spec.js', '*.spec.jsx'],
    plugins: {
      jestPlugin: jestPluginImport,
      jestFormattingPlugin: jestFormattingPluginImport,
      jestAsyncPlugin: jestAsyncPluginImport,
      jestDomPlugin: jestDomPluginImport,
    },
    env: {
      jest: true,
    },
    extends: [
      'plugin:jest/style',
      'plugin:jest-formatting/strict',
      'plugin:jest-dom/recommended',
    ],
    rules: {
      'jest-async/expect-return': 'error',
    },
  },
];
