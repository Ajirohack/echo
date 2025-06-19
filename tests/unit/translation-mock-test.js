/**
 * Mock Translation Test
 * This test file demonstrates how to use the translation services with mocks
 */

const { MockDeepLService, MockGPT4oTranslator, MockGoogleTranslate, MockAzureTranslator } = require('./mocks/translation-services-mock');
const { loadTestData, loadMockResponses } = require('./utils/translation-test-utils');

// Create instances of mock services
const mockDeepL = new MockDeepLService();
const mockGPT4o = new MockGPT4oTranslator();
const mockGoogle = new MockGoogleTranslate();
const mockAzure = new MockAzureTranslator();

// Initialize services
async function initServices() {
    console.log('Initializing translation services...');
    await Promise.all([
        mockDeepL.initialize(),
        mockGPT4o.initialize(),
        mockGoogle.initialize(),
        mockAzure.initialize()
    ]);
    console.log('All services initialized successfully.');
}

// Test basic translation
async function testTranslation() {
    console.log('\n===== TESTING BASIC TRANSLATION =====');

    const testText = 'Hello, how are you today?';
    const sourceLang = 'en';
    const targetLang = 'es';

    console.log(`Original text (${sourceLang}): "${testText}"`);

    // Translate with each service
    try {
        console.log('\nTranslating with DeepL:');
        const deeplResult = await mockDeepL.translate(testText, sourceLang, targetLang);
        console.log(`Result (${targetLang}): "${deeplResult.translation}"`);
        console.log(`Confidence: ${deeplResult.confidence.toFixed(2)}`);
    } catch (err) {
        console.error('DeepL translation failed:', err.message);
    }

    try {
        console.log('\nTranslating with GPT-4o:');
        const gpt4oResult = await mockGPT4o.translate(testText, sourceLang, targetLang);
        console.log(`Result (${targetLang}): "${gpt4oResult.translation}"`);
        console.log(`Confidence: ${gpt4oResult.confidence.toFixed(2)}`);
    } catch (err) {
        console.error('GPT-4o translation failed:', err.message);
    }

    try {
        console.log('\nTranslating with Google Translate:');
        const googleResult = await mockGoogle.translate(testText, sourceLang, targetLang);
        console.log(`Result (${targetLang}): "${googleResult.translation}"`);
        console.log(`Confidence: ${googleResult.confidence.toFixed(2)}`);
    } catch (err) {
        console.error('Google Translate failed:', err.message);
    }

    try {
        console.log('\nTranslating with Azure Translator:');
        const azureResult = await mockAzure.translate(testText, sourceLang, targetLang);
        console.log(`Result (${targetLang}): "${azureResult.translation}"`);
        console.log(`Confidence: ${azureResult.confidence.toFixed(2)}`);
    } catch (err) {
        console.error('Azure Translator failed:', err.message);
    }
}

// Test handling longer text
async function testLongTextTranslation() {
    console.log('\n===== TESTING LONG TEXT TRANSLATION =====');

    const longText = `
    The real-time translation application enables seamless communication 
    across language barriers. It integrates speech recognition, translation, 
    and speech synthesis technologies to provide fluid conversations. 
    The system prioritizes low latency and high accuracy, with multiple 
    fallback mechanisms to ensure reliability.
  `.trim();

    const sourceLang = 'en';
    const targetLang = 'fr';

    console.log(`Original text (${sourceLang}): "${longText.substring(0, 50)}..."`);
    console.log(`Length: ${longText.length} characters`);

    try {
        console.log('\nTranslating with GPT-4o (context-aware):');
        const gpt4oResult = await mockGPT4o.translate(longText, sourceLang, targetLang, {
            hasContext: true
        });
        console.log(`Result (${targetLang}): "${gpt4oResult.translation.substring(0, 50)}..."`);
        console.log(`Length: ${gpt4oResult.translation.length} characters`);
        console.log(`Confidence: ${gpt4oResult.confidence.toFixed(2)}`);
    } catch (err) {
        console.error('GPT-4o translation failed:', err.message);
    }
}

// Test language detection
async function testLanguageDetection() {
    console.log('\n===== TESTING LANGUAGE DETECTION =====');

    const texts = [
        'Hello, how are you today?',
        'Hola, ¿cómo estás hoy?',
        'Bonjour, comment allez-vous aujourd\'hui?',
        'Hallo, wie geht es Ihnen heute?'
    ];

    for (const text of texts) {
        console.log(`\nDetecting language for: "${text}"`);

        try {
            const result = await mockGoogle.detectLanguage(text);
            console.log(`Detected language: ${result.language}`);
            console.log(`Confidence: ${result.confidence.toFixed(2)}`);
        } catch (err) {
            console.error('Language detection failed:', err.message);
        }
    }
}

// Run all tests
async function runTests() {
    try {
        await initServices();
        await testTranslation();
        await testLongTextTranslation();
        await testLanguageDetection();

        console.log('\n===== ALL TESTS COMPLETED SUCCESSFULLY =====');
    } catch (err) {
        console.error('Test suite failed:', err);
    }
}

// Run the tests
runTests();
