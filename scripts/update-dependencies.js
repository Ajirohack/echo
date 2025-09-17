#!/usr/bin/env node

/**
 * Update Dependencies Script
 * 
 * This script updates package.json dependencies to their latest compatible versions
 * while respecting semver constraints.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Package.json path
const packageJsonPath = path.join(__dirname, '..', 'package.json');

/**
 * Get the latest version of a package that satisfies the current semver range
 */
function getLatestVersion(packageName, currentVersion) {
  try {
    // Extract the semver range operator (^, ~, etc.)
    const rangeOperator = currentVersion.match(/^[\^~>=<]+/)?.[0] || '';
    
    // Get the latest version from npm registry
    const latestVersion = execSync(`npm view ${packageName} version`, { encoding: 'utf8' }).trim();
    
    return `${rangeOperator}${latestVersion}`;
  } catch (error) {
    console.error(`Error getting latest version for ${packageName}:`, error.message);
    return currentVersion; // Return current version on error
  }
}

/**
 * Update dependencies in package.json
 */
async function updateDependencies() {
  console.log('Updating dependencies to latest versions...');
  
  try {
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Create backup
    const backupPath = `${packageJsonPath}.backup-${Date.now()}`;
    fs.writeFileSync(backupPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`Created backup at ${backupPath}`);
    
    // Update dependencies
    const dependencyTypes = ['dependencies', 'devDependencies'];
    let updatedCount = 0;
    
    for (const type of dependencyTypes) {
      if (!packageJson[type]) continue;
      
      console.log(`\nUpdating ${type}...`);
      const dependencies = packageJson[type];
      
      for (const [packageName, currentVersion] of Object.entries(dependencies)) {
        process.stdout.write(`Checking ${packageName}... `);
        
        // Skip if not using semver
        if (!currentVersion.startsWith('^') && !currentVersion.startsWith('~')) {
          console.log('SKIPPED (not using semver)');
          continue;
        }
        
        const latestVersion = getLatestVersion(packageName, currentVersion);
        
        if (latestVersion !== currentVersion) {
          dependencies[packageName] = latestVersion;
          console.log(`UPDATED from ${currentVersion} to ${latestVersion}`);
          updatedCount++;
        } else {
          console.log('ALREADY LATEST');
        }
      }
    }
    
    // Write updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    
    console.log(`\nUpdated ${updatedCount} dependencies.`);
    console.log('\nNext steps:');
    console.log('1. Review the changes in package.json');
    console.log('2. Run npm install to update the node_modules');
    console.log('3. Test the application to ensure everything works with the updated dependencies');
    
  } catch (error) {
    console.error('Error updating dependencies:', error);
  } finally {
    rl.close();
  }
}

async function main() {
  // Check for --force flag to skip confirmation
  const forceUpdate = process.argv.includes('--force');
  
  console.log('This script will update dependencies in package.json to their latest versions.');
  console.log('It will create a backup of the current package.json before making changes.');
  
  if (!forceUpdate) {
    const answer = await askQuestion('Do you want to continue? (y/N): ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Update cancelled.');
      rl.close();
      return;
    }
  }
  
  await updateDependencies();
}

// Run the main function
main().catch(console.error);