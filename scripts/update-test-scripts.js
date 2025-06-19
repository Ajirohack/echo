/**
 * Script to update package.json with new test scripts
 */

const fs = require('fs');
const path = require('path');

// Path to package.json
const packageJsonPath = path.join(__dirname, '../package.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add new test scripts
const newScripts = {
    "test:accessibility": "cross-env NODE_ENV=test mocha 'tests/accessibility/**/*.test.js' --reporter mochawesome",
    "test:visual": "cross-env NODE_ENV=test mocha 'tests/visual/**/*.test.js' --reporter mochawesome",
    "test:coverage": "nyc npm test",
    "test:coverage:report": "nyc report --reporter=html",
    "test:all": "npm run test:lint && npm run test:unit && npm run test:integration && npm run test:api && npm run test:performance && npm run test:e2e && npm run test:accessibility && npm run test:visual && npm run test:security",
    "test:ci": "npm run test:all && npm run test:coverage:report"
};

// Update scripts in package.json
packageJson.scripts = {
    ...packageJson.scripts,
    ...newScripts
};

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log('Updated package.json with new test scripts');

// List the new scripts added
console.log('New scripts:');
Object.keys(newScripts).forEach(script => {
    console.log(`  ${script}: ${newScripts[script]}`);
});
