// Global teardown for E2E tests
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  // Clean up any test artifacts
  const storageState = path.join(__dirname, 'storage-state.json');
  if (fs.existsSync(storageState)) {
    fs.unlinkSync(storageState);
  }
  
  // Stop any running servers
  const { teardown: teardownDevServer } = require('jest-dev-server');
  await teardownDevServer();
};
