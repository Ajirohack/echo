'use strict';

module.exports = {
  require: ['tests/test-helper.js'],
  recursive: true,
  timeout: 5000,
  exit: true,
  color: true,
  diff: true,
  extension: 'js',
  spec: ['tests/**/*.test.js'],
  'watch-files': ['src/**/*.js', 'tests/**/*.js'],
  'watch-ignore': ['node_modules', '.git']
};
