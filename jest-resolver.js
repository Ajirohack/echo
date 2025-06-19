const path = require('path');

module.exports = {
  sync: (context, moduleName, filename) => {
    if (moduleName.startsWith('@')) {
      return path.resolve(context.rootDir, '../src', moduleName.slice(1));
    }
    if (moduleName === 'electron') {
      return path.resolve(context.rootDir, 'setupTests.js');
    }
    return null;
  },
  async: null
};
