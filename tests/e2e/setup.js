// Global setup for E2E tests
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const storageState = path.join(__dirname, 'storage-state.json');

module.exports = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Save storage state to a file for later use in tests
  await context.storageState({ path: storageState });
  await browser.close();
  
  // Set environment variables for tests
  process.env.TEST_BASE_URL = 'http://localhost:3000';
  process.env.TEST_STORAGE_STATE = storageState;
};
