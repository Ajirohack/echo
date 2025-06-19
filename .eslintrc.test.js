module.exports = {
  env: {
    mocha: true,
    node: true,
    es6: true
  },
  extends: [
    'eslint:recommended',
    'plugin:mocha/recommended'
  ],
  plugins: [
    'mocha',
    'chai-friendly'
  ],
  rules: {
    'no-unused-expressions': 0,
    'chai-friendly/no-unused-expressions': 2,
    'mocha/no-mocha-arrows': 0,
    'mocha/no-setup-in-describe': 0,
    'mocha/no-hooks-for-single-case': 0,
    'mocha/no-identical-title': 2,
    'mocha/no-nested-tests': 2,
    'mocha/no-pending-tests': 1,
    'mocha/no-return-and-callback': 2,
    'mocha/no-sibling-hooks': 2,
    'mocha/no-skipped-tests': 1,
    'mocha/no-top-level-hooks': 2,
    'mocha/valid-suite-description': 0,
    'mocha/valid-test-description': 0,
    'mocha/max-top-level-suites': ['error', { limit: 1 }]
  },
  globals: {
    expect: 'readonly',
    expectRejection: 'readonly',
    sandbox: 'readonly'
  }
};
