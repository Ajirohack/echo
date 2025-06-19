// Setup file for E2E tests
const { setup: setupDevServer } = require('jest-dev-server');

module.exports = async () => {
  // Start your application server here if needed
  await setupDevServer({
    command: 'npm start',
    launchTimeout: 30000,
    debug: true,
    port: 3000,
  });
};
