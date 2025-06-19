/**
 * End-to-End Translation Pipeline Test
 * 
 * This script tests the complete translation pipeline:
 * Speech-to-Text → Translation → Text-to-Speech
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Import components
const TranslationManager = require('./src/services/translation/translation-manager');
// Assuming these modules exist in your project
// const SpeechToTextManager = require('./src/services/speech-to-text/speech-to-text-manager');
// const TextToSpeechManager = require('./src/services/text-to-speech/text-to-speech-manager');

// Sample audio file paths (replace with your actual paths)
const SAMPLE_AUDIO_EN = path.join(__dirname, 'assets', 'samples', 'english_sample.wav');
const SAMPLE_AUDIO_ES = path.join(__dirname, 'assets', 'samples', 'spanish_sample.wav');
const SAMPLE_AUDIO_FR = path.join(__dirname, 'assets', 'samples', 'french_sample.wav');

// Output directory for translated audio
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Mock function for STT and TTS for testing without actual services
async function mockSpeechToText(audioFilePath, sourceLanguage) {
    console.log(`[MOCK STT] Converting ${path.basename(audioFilePath)} to text (${sourceLanguage})...`);

    // Mock responses based on language
    const mockTexts = {
        'en': "Hello, this is a test of the translation pipeline. We're testing multiple language pairs.",
        'es': "Hola, esta es una prueba del sistema de traducción. Estamos probando varios pares de idiomas.",
        'fr': "Bonjour, ceci est un test du système de traduction. Nous testons plusieurs paires de langues."
    };

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    return mockTexts[sourceLanguage] || "Sample text for testing";
}

async function mockTextToSpeech(text, targetLanguage, outputFilePath) {
    console.log(`[MOCK TTS] Converting text to speech (${targetLanguage})...`);
    console.log(`Text: "${text}"`);
    console.log(`Output will be saved to: ${outputFilePath}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create an empty file to simulate output
    fs.writeFileSync(outputFilePath, 'Mock audio content');

    return {
        filePath: outputFilePath,
        duration: 3.5, // seconds
        format: 'wav'
    };
}

// Main test function
async function testTranslationPipeline() {
    console.log('=== End-to-End Translation Pipeline Test ===\n');

    // Initialize translation manager
    const translationManager = new TranslationManager();
    console.log('Initializing translation services...');
    await translationManager.initialize();

    // Test cases
    const testCases = [
        {
            audioFile: SAMPLE_AUDIO_EN,
            sourceLanguage: 'en',
            targetLanguage: 'es',
            options: { priority: 'quality' }
        },
        {
            audioFile: SAMPLE_AUDIO_EN,
            sourceLanguage: 'en',
            targetLanguage: 'fr',
            options: { context: 'Casual conversation', priority: 'quality' }
        },
        {
            audioFile: SAMPLE_AUDIO_ES,
            sourceLanguage: 'es',
            targetLanguage: 'en',
            options: { priority: 'speed' }
        }
    ];

    // Process each test case
    for (const [index, testCase] of testCases.entries()) {
        try {
            console.log(`\n--- Test Case ${index + 1}: ${testCase.sourceLanguage} → ${testCase.targetLanguage} ---`);

            // Step 1: Speech-to-Text
            console.log('\nStep 1: Speech-to-Text');
            const recognizedText = await mockSpeechToText(
                testCase.audioFile,
                testCase.sourceLanguage
            );
            console.log(`Recognized text: "${recognizedText}"`);

            // Step 2: Translation
            console.log('\nStep 2: Translation');
            console.log(`Translating from ${testCase.sourceLanguage} to ${testCase.targetLanguage}...`);
            const translationResult = await translationManager.translate(
                recognizedText,
                testCase.sourceLanguage,
                testCase.targetLanguage,
                testCase.options
            );

            console.log(`Translation (${translationResult.service}): "${translationResult.translation}"`);
            console.log(`Quality score: ${translationResult.quality?.score?.toFixed(2) || 'N/A'}`);

            // Step 3: Text-to-Speech
            console.log('\nStep 3: Text-to-Speech');
            const outputFilePath = path.join(
                OUTPUT_DIR,
                `translated_${testCase.sourceLanguage}_to_${testCase.targetLanguage}_${index}.wav`
            );

            const ttsResult = await mockTextToSpeech(
                translationResult.translation,
                testCase.targetLanguage,
                outputFilePath
            );

            console.log(`Audio file created: ${ttsResult.filePath}`);
            console.log(`Duration: ${ttsResult.duration}s`);

            // Results summary
            console.log('\nPipeline Execution Summary:');
            console.log(`- Source Language: ${testCase.sourceLanguage}`);
            console.log(`- Target Language: ${testCase.targetLanguage}`);
            console.log(`- Translation Service: ${translationResult.service}`);
            console.log(`- Translation Quality: ${translationResult.quality?.score?.toFixed(2) || 'N/A'}`);
            console.log(`- Output File: ${path.basename(ttsResult.filePath)}`);

        } catch (error) {
            console.error(`Error processing test case ${index + 1}:`, error);
        }
    }

    // Check service status at the end
    const status = translationManager.getServiceStatus();
    console.log('\nTranslation Service Status:');
    Object.entries(status.services).forEach(([name, serviceStatus]) => {
        console.log(`- ${name}: ${serviceStatus.healthy ? 'Healthy' : 'Unhealthy'}`);
    });

    // Cleanup
    translationManager.destroy();
    console.log('\n=== End-to-End Test Completed ===');
}

// Run the test
testTranslationPipeline().catch(error => {
    console.error('Test failed:', error);
});
