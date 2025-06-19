/**
 * Translation Service Integration Test
 * Tests the complete multi-service translation integration
 */

require('dotenv').config();
const TranslationManager = require('./src/services/translation/translation-manager');

async function runTranslationTest() {
    // Initialize translation manager
    const translationManager = new TranslationManager();

    try {
        console.log('Initializing translation services...');
        await translationManager.initialize();

        // Test translations with different language pairs and services
        const testCases = [
            {
                text: "Hello, how are you today?",
                fromLanguage: "en",
                toLanguage: "es",
                options: { priority: 'quality' }
            },
            {
                text: "Artificial intelligence is transforming how we interact with technology.",
                fromLanguage: "en",
                toLanguage: "fr",
                options: { context: "Technical article about AI advancements", domain: "technical" }
            },
            {
                text: "This should use the caching mechanism for better performance.",
                fromLanguage: "en",
                toLanguage: "de",
                options: { priority: 'speed' }
            },
            {
                text: "Cultural context helps with more natural translations.",
                fromLanguage: "en",
                toLanguage: "ja",
                options: { context: "Discussion about translation technology", hasContext: true }
            }
        ];

        console.log('\nRunning translation tests...\n');

        for (const testCase of testCases) {
            console.log(`\n=== Test Case: ${testCase.fromLanguage} → ${testCase.toLanguage} ===`);
            console.log(`Original: "${testCase.text}"`);
            console.log(`Options: ${JSON.stringify(testCase.options)}`);

            // First translation
            console.log('Translating...');
            const startTime = Date.now();
            try {
                const result1 = await translationManager.translate(
                    testCase.text,
                    testCase.fromLanguage,
                    testCase.toLanguage,
                    testCase.options
                );

                const elapsedTime = Date.now() - startTime;
                console.log(`Translated (${result1.service}): "${result1.translation}"`);
                console.log(`Processing time: ${elapsedTime}ms`);
                console.log(`Quality score: ${result1.quality?.score?.toFixed(2) || 'N/A'}`);

                // Test caching by translating the same text again
                console.log('\nTesting cache (same text)...');
                const cacheStartTime = Date.now();
                const result2 = await translationManager.translate(
                    testCase.text,
                    testCase.fromLanguage,
                    testCase.toLanguage,
                    testCase.options
                );

                const cacheTime = Date.now() - cacheStartTime;
                console.log(`Cached result retrieved in ${cacheTime}ms`);
                console.log(`Cache hit: ${result2.cached ? 'Yes' : 'No'}`);

                // Test with different options
                if (testCase.options.priority === 'quality') {
                    console.log('\nTesting with different priority (speed)...');
                    const newOptions = { ...testCase.options, priority: 'speed' };
                    const result3 = await translationManager.translate(
                        testCase.text,
                        testCase.fromLanguage,
                        testCase.toLanguage,
                        newOptions
                    );

                    console.log(`Translated (${result3.service}): "${result3.translation}"`);
                    console.log(`Changed service: ${result3.service !== result1.service ? 'Yes' : 'No'}`);
                }
            } catch (error) {
                console.error(`Translation failed: ${error.message}`);
            }

            // Print service status
            console.log('\nService status:');
            const status = translationManager.getServiceStatus();
            Object.entries(status.services).forEach(([name, serviceStatus]) => {
                console.log(`- ${name}: ${serviceStatus.healthy ? 'Healthy' : 'Unhealthy'}`);
            });

            console.log('\nCache stats:', status.cacheStats);
        }

        // Get supported language pairs
        try {
            const languagePairs = await translationManager.getSupportedLanguagePairs();
            console.log(`\nSupported language pairs: ${languagePairs.length}`);
            console.log('Sample pairs:', languagePairs.slice(0, 5));
        } catch (error) {
            console.error('Failed to get supported language pairs:', error.message);
        }

        console.log('\nTests completed successfully!');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Clean up
        translationManager.destroy();
    }
}

// Run the test
runTranslationTest().catch(console.error);
