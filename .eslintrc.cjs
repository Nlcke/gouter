/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['airbnb', 'prettier'],
  rules: {
    'no-restricted-syntax': 'off',
    'operator-linebreak': 'off',
    'implicit-arrow-linebreak': 'off',
    'function-paren-newline': 'off',
    'object-curly-newline': 'off',
    'guard-for-in': 'off',
    'import/extensions': 'off',
    'react/function-component-definition': 'off',
    'react/prop-types': 'off',
    'no-nested-ternary': 'off',
    'react/no-children-prop': 'off',
  },
};
