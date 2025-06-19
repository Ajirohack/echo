/**
 * Unit tests for LanguagePairOptimizer
 */

const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const LanguagePairOptimizer = require('../../../../../src/services/translation/utils/language-pair-optimizer');

describe('LanguagePairOptimizer', () => {
    let optimizer;
    let sandbox;
    let mockTranslationManager;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Create mock translation manager
        mockTranslationManager = {
            services: {
                deepl: { healthy: true },
                gpt4o: { healthy: true },
                google: { healthy: true },
                azure: { healthy: true }
            }
        };

        optimizer = new LanguagePairOptimizer(mockTranslationManager);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should initialize language pairs from config', () => {
            expect(optimizer.languagePairs).to.be.instanceOf(Map);
            expect(optimizer.languagePairs.size).to.be.greaterThan(0);
        });

        it('should load language sets from config', () => {
            expect(optimizer.europeanLanguages).to.be.instanceOf(Set);
            expect(optimizer.europeanLanguages.size).to.be.greaterThan(0);
            expect(optimizer.europeanLanguages.has('en')).to.be.true;

            expect(optimizer.asianLanguages).to.be.instanceOf(Set);
            expect(optimizer.asianLanguages.size).to.be.greaterThan(0);
            expect(optimizer.asianLanguages.has('ja')).to.be.true;

            expect(optimizer.adaptationLanguages).to.be.instanceOf(Set);
            expect(optimizer.adaptationLanguages.size).to.be.greaterThan(0);
        });

        it('should load default ranking from config', () => {
            expect(optimizer.defaultRanking).to.be.an('object');
            expect(optimizer.defaultRanking.quality).to.be.an('array');
            expect(optimizer.defaultRanking.speed).to.be.an('array');
        });
    });

    describe('getBestServiceForLanguagePair', () => {
        it('should select based on language pair config', () => {
            // English to Spanish is a configured pair
            const service = optimizer.getBestServiceForLanguagePair('en', 'es', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                }
            });

            // Should select one of the configured services
            expect(['deepl', 'gpt4o', 'google', 'azure']).to.include(service);
        });

        it('should prioritize based on quality score', () => {
            // Mock a language pair with deepl having highest quality
            optimizer.languagePairs.set('en-fr', {
                source: 'en',
                target: 'fr',
                services: {
                    deepl: { quality: 0.95, speed: 0.8 },
                    gpt4o: { quality: 0.9, speed: 0.7 },
                    google: { quality: 0.85, speed: 0.9 },
                    azure: { quality: 0.8, speed: 0.85 }
                }
            });

            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                }
            });

            // Should select deepl as it has highest quality
            expect(service).to.equal('deepl');
        });

        it('should prioritize based on speed', () => {
            // Mock a language pair with google having highest speed
            optimizer.languagePairs.set('en-fr', {
                source: 'en',
                target: 'fr',
                services: {
                    deepl: { quality: 0.95, speed: 0.8 },
                    gpt4o: { quality: 0.9, speed: 0.7 },
                    google: { quality: 0.85, speed: 0.9 }, // Highest speed
                    azure: { quality: 0.8, speed: 0.85 }
                }
            });

            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'speed', // Prioritize speed
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                }
            });

            // Should select google as it has highest speed
            expect(service).to.equal('google');
        });

        it('should respect service health status', () => {
            // Mock a language pair with deepl having highest quality but unhealthy
            optimizer.languagePairs.set('en-fr', {
                source: 'en',
                target: 'fr',
                services: {
                    deepl: { quality: 0.95, speed: 0.8 },
                    gpt4o: { quality: 0.9, speed: 0.7 },
                    google: { quality: 0.85, speed: 0.9 },
                    azure: { quality: 0.8, speed: 0.85 }
                }
            });

            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: false }, // Unhealthy
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                }
            });

            // Should select gpt4o as it has second highest quality
            expect(service).to.equal('gpt4o');
        });

        it('should handle unconfigured language pairs', () => {
            // Unconfigured language pair
            const service = optimizer.getBestServiceForLanguagePair('it', 'ru', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                }
            });

            // Should still select a service
            expect(['deepl', 'gpt4o', 'google', 'azure']).to.include(service);
        });

        it('should prefer DeepL for European languages', () => {
            // Both Italian and French are European languages
            const service = optimizer.getBestServiceForLanguagePair('it', 'fr', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                }
            });

            // Should select DeepL for European language pair
            expect(service).to.equal('deepl');
        });

        it('should prefer GPT-4o for Asian languages', () => {
            // Japanese is in the adaptation languages list
            const service = optimizer.getBestServiceForLanguagePair('en', 'ja', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                }
            });

            // Should select GPT-4o for Asian language
            expect(service).to.equal('gpt4o');
        });

        it('should respect user preference', () => {
            // Even though deepl might be better for this pair
            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                },
                userPreference: 'google' // User prefers Google
            });

            // Should respect user preference
            expect(service).to.equal('google');
        });

        it('should ignore unhealthy user preference', () => {
            // User prefers Google but it's unhealthy
            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: false }, // Unhealthy
                    azure: { healthy: true }
                },
                userPreference: 'google' // Unhealthy
            });

            // Should not use user preference as it's unhealthy
            expect(service).to.not.equal('google');
        });

        it('should prioritize context-aware services when context is required', () => {
            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'speed', // Would normally select Google
                serviceHealth: {
                    deepl: { healthy: true },
                    gpt4o: { healthy: true },
                    google: { healthy: true },
                    azure: { healthy: true }
                },
                requiresContext: true // Requires context
            });

            // Should prioritize a context-aware service (based on defaultRanking.context)
            expect(service).to.equal(optimizer.defaultRanking.context[0]);
        });

        it('should return a healthy service when all preferred services are unhealthy', () => {
            // All main services unhealthy
            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: false },
                    gpt4o: { healthy: false },
                    google: { healthy: false },
                    azure: { healthy: true } // Only Azure is healthy
                }
            });

            // Should select the only healthy service
            expect(service).to.equal('azure');
        });
    });

    describe('updateQualityScore', () => {
        it('should update quality score with smoothing', () => {
            // Set up initial quality score
            optimizer.languagePairs.set('en-es', {
                source: 'en',
                target: 'es',
                services: {
                    deepl: { quality: 0.8, speed: 0.8 }
                }
            });

            // Update quality score
            optimizer.updateQualityScore('deepl', 'en', 'es', 1.0); // Perfect score

            // Get updated pair
            const pair = optimizer.languagePairs.get('en-es');

            // Should update with smoothing (0.8 * 0.9 + 1.0 * 0.1 = 0.82)
            expect(pair.services.deepl.quality).to.be.closeTo(0.82, 0.001);
        });

        it('should handle non-existent language pair', () => {
            // This should not throw
            optimizer.updateQualityScore('deepl', 'nonexistent', 'pair', 1.0);
        });

        it('should handle non-existent service', () => {
            // This should not throw
            optimizer.updateQualityScore('nonexistent', 'en', 'es', 1.0);
        });
    });

    describe('edge cases', () => {
        it('should handle all services being unhealthy', () => {
            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'quality',
                serviceHealth: {
                    deepl: { healthy: false },
                    gpt4o: { healthy: false },
                    google: { healthy: false },
                    azure: { healthy: false }
                }
            });

            // Should return a default service
            expect(service).to.equal('google');
        });

        it('should handle empty serviceHealth object', () => {
            const service = optimizer.getBestServiceForLanguagePair('en', 'fr', {
                priority: 'quality',
                serviceHealth: {}
            });

            // Should return a service based on default ranking
            expect(['deepl', 'gpt4o', 'google', 'azure']).to.include(service);
        });

        it('should handle missing options', () => {
            const service = optimizer.getBestServiceForLanguagePair('en', 'fr');

            // Should return a service without throwing
            expect(['deepl', 'gpt4o', 'google', 'azure']).to.include(service);
        });
    });
});
