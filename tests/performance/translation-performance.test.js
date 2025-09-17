/**
 * Performance Tests for Translation Pipeline
 * 
 * These tests measure the performance characteristics of the translation system,
 * including latency, throughput, and resource utilization.
 */

const { expect } = require('chai');
// Sinon functionality replaced with Jest mocks
const fs = require('fs');
const path = require('path');

// Import components
const TranslationManager = require('../../src/services/translation/translation-manager');
const STTManager = require('../../src/services/stt/STTManager');
const TTSManager = require('../../src/services/tts/TTSManager');

// Import test utilities
const {
    loadTestData,
    createMockServices,
    delay
} = require('../utils/translation-test-utils');

describe('Translation Performance Tests', function () {
    // These tests can take longer
    this.timeout(30000);

    let translationManager;
    let sttManager;
    let ttsManager;
    let sandbox;
    let testData;

    before(async function () {
        // Load test data
        testData = loadTestData('translation-test-data.json');

        // Create sandbox
        sandbox = sinon.createSandbox();
    });

    beforeEach(async function () {
        // Create and initialize managers with mock services
        translationManager = new TranslationManager();
        translationManager.services = createMockServices();

        sttManager = new STTManager();
        ttsManager = new TTSManager();

        // Initialize components
        await translationManager.initialize();
        await sttManager.initialize();
        await ttsManager.initialize();
    });

    afterEach(function () {
        sandbox.restore();
        if (translationManager) translationManager.destroy();
        if (sttManager) sttManager.destroy();
        if (ttsManager) ttsManager.destroy();
    });

    describe('Translation Service Latency', function () {
        it('should measure individual service latency', async function () {
            const results = {
                deepl: [],
                gpt4o: [],
                google: [],
                azure: []
            };

            // Test text to translate
            const text = 'Hello world, this is a performance test for the translation system.';
            const iterations = 5;

            // Measure latency for each service
            for (const service of Object.keys(results)) {
                for (let i = 0; i < iterations; i++) {
                    const startTime = Date.now();

                    try {
                        const result = await translationManager.attemptTranslation(
                            service,
                            text,
                            'en',
                            'es'
                        );

                        const endTime = Date.now();
                        const latency = endTime - startTime;

                        results[service].push({
                            latency,
                            success: result.success,
                            iteration: i
                        });
                    } catch (error) {
                        results[service].push({
                            latency: Date.now() - startTime,
                            success: false,
                            error: error.message,
                            iteration: i
                        });
                    }

                    // Small delay between tests
                    await delay(100);
                }
            }

            // Calculate and report average latencies
            const averages = {};
            for (const [service, measurements] of Object.entries(results)) {
                const successfulMeasurements = measurements.filter(m => m.success);
                if (successfulMeasurements.length > 0) {
                    const totalLatency = successfulMeasurements.reduce((sum, m) => sum + m.latency, 0);
                    averages[service] = totalLatency / successfulMeasurements.length;
                } else {
                    averages[service] = null; // All attempts failed
                }
            }

            console.log('Average service latencies (ms):', averages);

            // Verify all services completed successfully at least once
            for (const service of Object.keys(results)) {
                const successCount = results[service].filter(m => m.success).length;
                expect(successCount).to.be.greaterThan(0, `${service} should succeed at least once`);
            }

            // Verify latencies are within acceptable ranges
            // These thresholds should be adjusted based on your performance requirements
            expect(averages.deepl).to.be.lessThan(500, 'DeepL latency should be under 500ms');
            expect(averages.google).to.be.lessThan(500, 'Google latency should be under 500ms');
            expect(averages.azure).to.be.lessThan(500, 'Azure latency should be under 500ms');
            // GPT-4o is expected to be slower
            expect(averages.gpt4o).to.be.lessThan(1000, 'GPT-4o latency should be under 1000ms');
        });
    });

    describe('Translation Pipeline Throughput', function () {
        it('should handle multiple concurrent translation requests', async function () {
            // Number of concurrent requests
            const concurrentRequests = 10;

            // Sample texts to translate
            const texts = testData.testCases.map(tc => tc.text);

            // Create array of translation promises
            const translationPromises = [];

            const startTime = Date.now();

            // Launch concurrent translations
            for (let i = 0; i < concurrentRequests; i++) {
                const textIndex = i % texts.length;
                const promise = translationManager.translate(
                    texts[textIndex],
                    'en',
                    'es',
                    { priority: 'speed' } // Prioritize speed for throughput test
                );
                translationPromises.push(promise);
            }

            // Wait for all translations to complete
            const results = await Promise.all(translationPromises);

            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Calculate metrics
            const successCount = results.filter(r => r.success).length;
            const throughput = (successCount / totalTime) * 1000; // translations per second

            console.log(`Throughput: ${throughput.toFixed(2)} translations/second`);
            console.log(`Total time for ${concurrentRequests} requests: ${totalTime}ms`);

            // Verify all translations succeeded
            expect(successCount).to.equal(concurrentRequests, 'All translations should succeed');

            // Verify minimum throughput
            // This threshold should be adjusted based on your performance requirements
            expect(throughput).to.be.greaterThan(5, 'Throughput should be at least 5 translations/second');
        });
    });

    describe('Complete Pipeline Performance', function () {
        it('should measure end-to-end pipeline latency', async function () {
            // Mock the STT and TTS components
            sandbox.stub(sttManager, 'transcribeAudio').callsFake(async () => {
                await delay(300); // Simulate STT processing time
                return {
                    text: 'Hello, this is a test of the translation system.',
                    confidence: 0.95,
                    language: 'en',
                    service: 'whisper'
                };
            });

            sandbox.stub(ttsManager, 'synthesizeSpeech').callsFake(async (text, language) => {
                await delay(500); // Simulate TTS processing time
                return {
                    audioFile: '/path/to/mock/output.wav',
                    duration: 2.5,
                    service: 'elevenlabs',
                    voice: 'default'
                };
            });

            const iterations = 3;
            const results = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();

                // Step 1: Speech-to-Text
                const sttResult = await sttManager.transcribeAudio('/path/to/mock/input.wav');
                const sttTime = Date.now();

                // Step 2: Translation
                const translationResult = await translationManager.translate(
                    sttResult.text,
                    sttResult.language,
                    'es',
                    { context: 'System test' }
                );
                const translationTime = Date.now();

                // Step 3: Text-to-Speech
                const ttsResult = await ttsManager.synthesizeSpeech(
                    translationResult.translation,
                    'es',
                    { voice: 'default' }
                );
                const endTime = Date.now();

                // Calculate component latencies
                const sttLatency = sttTime - startTime;
                const translationLatency = translationTime - sttTime;
                const ttsLatency = endTime - translationTime;
                const totalLatency = endTime - startTime;

                results.push({
                    iteration: i,
                    sttLatency,
                    translationLatency,
                    ttsLatency,
                    totalLatency
                });

                // Small delay between iterations
                await delay(200);
            }

            // Calculate averages
            const avgSttLatency = results.reduce((sum, r) => sum + r.sttLatency, 0) / iterations;
            const avgTranslationLatency = results.reduce((sum, r) => sum + r.translationLatency, 0) / iterations;
            const avgTtsLatency = results.reduce((sum, r) => sum + r.ttsLatency, 0) / iterations;
            const avgTotalLatency = results.reduce((sum, r) => sum + r.totalLatency, 0) / iterations;

            console.log('Average STT latency:', avgSttLatency.toFixed(2), 'ms');
            console.log('Average Translation latency:', avgTranslationLatency.toFixed(2), 'ms');
            console.log('Average TTS latency:', avgTtsLatency.toFixed(2), 'ms');
            console.log('Average Total latency:', avgTotalLatency.toFixed(2), 'ms');

            // Verify performance meets requirements
            expect(avgSttLatency).to.be.lessThan(1000, 'STT should complete within 1000ms');
            expect(avgTranslationLatency).to.be.lessThan(500, 'Translation should complete within 500ms');
            expect(avgTtsLatency).to.be.lessThan(1500, 'TTS should complete within 1500ms');
            expect(avgTotalLatency).to.be.lessThan(4000, 'Complete pipeline should finish within 4000ms');
        });
    });

    describe('Resource Utilization', function () {
        it('should measure memory usage during translation', async function () {
            // Skip this test in CI environments where memory measurement may be unreliable
            if (process.env.CI) {
                this.skip();
                return;
            }

            // Get initial memory usage
            const initialMemory = process.memoryUsage();

            // Number of translations to perform
            const iterations = 50;

            // Perform multiple translations
            for (let i = 0; i < iterations; i++) {
                const result = await translationManager.translate(
                    `Test message ${i} for memory usage measurement.`,
                    'en',
                    'es'
                );

                // Verify translation succeeded
                expect(result.success).to.be.true;
            }

            // Measure final memory usage
            const finalMemory = process.memoryUsage();

            // Calculate memory increase
            const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const rssIncrease = finalMemory.rss - initialMemory.rss;

            console.log(`Memory usage after ${iterations} translations:`);
            console.log(`Heap increase: ${(heapIncrease / 1024 / 1024).toFixed(2)} MB`);
            console.log(`RSS increase: ${(rssIncrease / 1024 / 1024).toFixed(2)} MB`);

            // Verify memory increase is within acceptable limits
            // These thresholds should be adjusted based on your resource constraints
            expect(heapIncrease).to.be.lessThan(50 * 1024 * 1024, 'Heap increase should be less than 50MB');
            expect(rssIncrease).to.be.lessThan(100 * 1024 * 1024, 'RSS increase should be less than 100MB');
        });
    });
});

describe('Translation Cache Performance', function () {
    let translationManager;
    let sandbox;

    beforeEach(async function () {
        sandbox = sinon.createSandbox();

        // Create and initialize translation manager
        translationManager = new TranslationManager();
        translationManager.services = createMockServices();
        await translationManager.initialize();
    });

    afterEach(function () {
        sandbox.restore();
        if (translationManager) translationManager.destroy();
    });

    it('should improve performance with caching', async function () {
        // Texts to translate
        const texts = [
            'Hello world',
            'How are you today?',
            'The weather is beautiful'
        ];

        // First round - without cache
        const firstRoundTimes = [];

        for (const text of texts) {
            const startTime = Date.now();
            const result = await translationManager.translate(text, 'en', 'es', { useCache: false });
            const endTime = Date.now();

            firstRoundTimes.push(endTime - startTime);
            expect(result.success).to.be.true;
        }

        // Second round - with cache
        const secondRoundTimes = [];

        for (const text of texts) {
            const startTime = Date.now();
            const result = await translationManager.translate(text, 'en', 'es', { useCache: true });
            const endTime = Date.now();

            secondRoundTimes.push(endTime - startTime);
            expect(result.success).to.be.true;
            expect(result.cached).to.be.true;
        }

        // Calculate average times
        const avgFirstRound = firstRoundTimes.reduce((sum, t) => sum + t, 0) / firstRoundTimes.length;
        const avgSecondRound = secondRoundTimes.reduce((sum, t) => sum + t, 0) / secondRoundTimes.length;

        console.log('Average time without cache:', avgFirstRound.toFixed(2), 'ms');
        console.log('Average time with cache:', avgSecondRound.toFixed(2), 'ms');
        console.log('Performance improvement:', ((avgFirstRound - avgSecondRound) / avgFirstRound * 100).toFixed(2), '%');

        // Verify cache provides significant performance improvement
        expect(avgSecondRound).to.be.lessThan(avgFirstRound * 0.5, 'Cache should reduce latency by at least 50%');
    });
});
