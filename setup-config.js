#!/usr/bin/env node

/**
 * Configuration Setup Script
 * Sets up the configuration files for translation services
 * 
 * This script can use environment variables from a .env file or system environment
 * to configure the application without manual input.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

// Load .env file if exists
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    console.log('Loading configuration from .env file...');
    dotenv.config();
  } else {
    console.log('No .env file found. You can create one based on .env.example for automated setup.');
    dotenv.config({ path: path.join(__dirname, '.env.example') });
  }
} catch (error) {
  console.error('Error loading .env file:', error.message);
}

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
        if (apiKey && apiKey !== `your_${envVarName.toLowerCase()}_here` && 
            apiKey !== 'YOUR_' + envVarName && 
            !apiKey.includes('your_') && 
            !apiKey.includes('YOUR_')) {
            console.log(`Using ${name} API key from environment variables.`);
            return resolve(apiKey);
        }

        // Otherwise, prompt the user
        console.log(`\n${name} API Key not found in environment variables.`);
        console.log(`You can set it permanently by adding ${envVarName}=your_api_key to your .env file.`);
        rl.question(`Enter your ${name} API key (or press Enter to skip): `, (answer) => {
            if (!answer.trim()) {
                console.log(`Skipped ${name} configuration. You can set it later in config files or .env.`);
            }
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
            console.log(`Creating default config file: ${configPath}`);
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(CONFIG_DIR)) {
                fs.mkdirSync(CONFIG_DIR, { recursive: true });
            }
            
            // Create empty config file with basic structure
            fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
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
    console.log('This script will help you configure the translation services.');
    console.log('You can also set these values using environment variables in a .env file.');
    console.log('See .env.example for all available configuration options.\n');

    try {
        // Get API keys for translation services
        const deeplApiKey = await getApiKey('DeepL', 'DEEPL_API_KEY');
        const openaiApiKey = await getApiKey('OpenAI', 'OPENAI_API_KEY');
        const googleApiKey = await getApiKey('Google Translate', 'GOOGLE_TRANSLATE_API_KEY');
        const azureApiKey = await getApiKey('Azure Translator', 'AZURE_TRANSLATOR_API_KEY');
        
        // Get API keys for TTS services
        const elevenLabsApiKey = await getApiKey('ElevenLabs', 'ELEVENLABS_API_KEY');
        const azureTtsApiKey = await getApiKey('Azure TTS', 'AZURE_TTS_API_KEY');
        
        // Get region settings
        const azureRegion = process.env.AZURE_REGION || await new Promise((resolve) => {
            rl.question('Enter Azure region (default: eastus): ', (answer) => {
                resolve(answer.trim() || 'eastus');
            });
        });

        // Update translation config
        await updateConfigFile('translation-config.json', {
            'services.deepl.apiKey': deeplApiKey,
            'services.gpt4o.apiKey': openaiApiKey,
            'services.google.apiKey': googleApiKey,
            'services.azure.apiKey': azureApiKey,
            'services.azure.region': azureRegion
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
            'apiKey': azureApiKey,
            'region': azureRegion
        });
        
        // Update TTS config
        await updateConfigFile('tts-config.json', {
            'services.elevenlabs.apiKey': elevenLabsApiKey,
            'services.azure.apiKey': azureTtsApiKey,
            'services.azure.region': azureRegion
        });
        
        // Update AI providers config
        await updateConfigFile('ai-providers.json', {
            'providers.openai.apiKey': openaiApiKey,
            'providers.groq.apiKey': process.env.GROQ_API_KEY || '',
            'providers.huggingface.apiKey': process.env.HUGGINGFACE_API_KEY || ''
        });

        console.log('\nConfiguration setup complete!');
        console.log('\nEnvironment Variables:');
        console.log('- For automated setup, create a .env file based on .env.example');
        console.log('- Set API keys and other configuration in the .env file');
        console.log('- The application will use environment variables when available');
        
        console.log('\nNext Steps:');
        console.log('- You can now run the translation tests with:');
        console.log('  npm run test:translation-mock  # For tests with mock services');
        console.log('  npm run test:translation       # For tests with real services');
        console.log('- Edit config files manually in the config/ directory if needed');

    } catch (error) {
        console.error('Error during setup:', error);
    } finally {
        rl.close();
    }
}

// Run the setup
setupConfig();
