/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['airbnb', 'prettier', 'plugin:react-hooks/recommended'],
  rules: {
    'react-hooks/exhaustive-deps': 'error',
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
    'import/no-extraneous-dependencies': 'off',
    'react/jsx-filename-extension': 'off',
    'arrow-body-style': 'off',
    'class-methods-use-this': 'off',
    'import/prefer-default-export': 'off',
  },
};
