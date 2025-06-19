#!/usr/bin/env node

/**
 * Configuration Setup Script
 * Sets up the configuration files for translation services
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load .env file if exists
dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Directories
const CONFIG_DIR = path.join(__dirname, 'config');

// Function to get API key from .env or prompt user
async function getApiKey(name, envVarName) {
    return new Promise((resolve) => {
        // Check if env var exists
        const apiKey = process.env[envVarName];
        if (apiKey && apiKey !== `your_${envVarName.toLowerCase()}_here`) {
            console.log(`Using ${name} API key from environment variables.`);
            return resolve(apiKey);
        }

        // Otherwise, prompt the user
        rl.question(`Enter your ${name} API key: `, (answer) => {
            resolve(answer.trim());
        });
    });
}

// Update config file with actual API keys
async function updateConfigFile(configFile, updates) {
    try {
        const configPath = path.join(CONFIG_DIR, configFile);

        // Check if file exists
        if (!fs.existsSync(configPath)) {
            console.error(`Config file not found: ${configPath}`);
            return false;
        }

        // Read and parse the config file
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Apply updates
        for (const [key, value] of Object.entries(updates)) {
            const keyParts = key.split('.');
            let currentObj = config;

            // Navigate to the nested property
            for (let i = 0; i < keyParts.length - 1; i++) {
                const part = keyParts[i];
                if (!currentObj[part]) {
                    currentObj[part] = {};
                }
                currentObj = currentObj[part];
            }

            // Set the final property
            const finalKey = keyParts[keyParts.length - 1];
            currentObj[finalKey] = value;
        }

        // Write the updated config back to file
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log(`Updated ${configFile} with new settings.`);
        return true;
    } catch (error) {
        console.error(`Error updating ${configFile}:`, error);
        return false;
    }
}

// Main function to run the setup
async function setupConfig() {
    console.log('Translation Services Configuration Setup\n');

    try {
        // Get API keys
        const deeplApiKey = await getApiKey('DeepL', 'DEEPL_API_KEY');
        const openaiApiKey = await getApiKey('OpenAI', 'OPENAI_API_KEY');
        const googleApiKey = await getApiKey('Google Translate', 'GOOGLE_TRANSLATE_API_KEY');
        const azureApiKey = await getApiKey('Azure Translator', 'AZURE_TRANSLATOR_KEY');

        // Update translation config
        await updateConfigFile('translation-config.json', {
            'services.deepl.apiKey': deeplApiKey,
            'services.gpt4o.apiKey': openaiApiKey,
            'services.google.apiKey': googleApiKey,
            'services.azure.apiKey': azureApiKey
        });

        // Update individual service configs
        await updateConfigFile('deepl-config.json', {
            'apiKey': deeplApiKey
        });

        await updateConfigFile('gpt4o-config.json', {
            'apiKey': openaiApiKey
        });

        await updateConfigFile('google-translate-config.json', {
            'apiKey': googleApiKey
        });

        await updateConfigFile('azure-translator-config.json', {
            'apiKey': azureApiKey
        });

        console.log('\nConfiguration setup complete!');
        console.log('You can now run the translation tests with:');
        console.log('  npm run test:translation-mock  # For tests with mock services');
        console.log('  npm run test:translation       # For tests with real services');

    } catch (error) {
        console.error('Error during setup:', error);
    } finally {
        rl.close();
    }
}

// Run the setup
setupConfig();
