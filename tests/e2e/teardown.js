// Global teardown for E2E tests
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  try {
    // Clean up any test artifacts
    const storageState = path.join(__dirname, 'storage-state.json');
    if (fs.existsSync(storageState)) {
      fs.unlinkSync(storageState);
    }

    // Stop any running servers - only if they were started
    try {
      const { teardown: teardownDevServer } = require('jest-dev-server');
      await teardownDevServer();
    } catch (serverError) {
      console.log('No dev server to tear down or server already stopped');
    }
  } catch (error) {
    console.error('Error during E2E test teardown:', error);
  }
};
