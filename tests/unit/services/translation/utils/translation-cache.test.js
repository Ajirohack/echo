/**
 * Unit tests for TranslationCache utility
 */

const { expect } = require('chai');
const sinon = require('sinon');
const TranslationCache = require('../../../../../src/services/translation/utils/translation-cache');

describe('TranslationCache', () => {
    let cache;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        cache = new TranslationCache({
            maxCacheSize: 10,
            defaultExpirySeconds: 60
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should initialize with default settings', () => {
            const defaultCache = new TranslationCache();
            expect(defaultCache.config.maxCacheSize).to.be.greaterThan(0);
            expect(defaultCache.config.defaultExpirySeconds).to.be.greaterThan(0);
        });

        it('should initialize with custom settings', () => {
            expect(cache.config.maxCacheSize).to.equal(10);
            expect(cache.config.defaultExpirySeconds).to.equal(60);
        });

        it('should initialize stats with zero values', () => {
            expect(cache.stats.hits).to.equal(0);
            expect(cache.stats.misses).to.equal(0);
            expect(cache.stats.totalRequests).to.equal(0);
        });
    });

    describe('generateKey', () => {
        it('should generate unique keys for different text', () => {
            const key1 = cache.generateKey('Hello', 'en', 'es');
            const key2 = cache.generateKey('World', 'en', 'es');
            expect(key1).to.not.equal(key2);
        });

        it('should generate unique keys for different language pairs', () => {
            const key1 = cache.generateKey('Hello', 'en', 'es');
            const key2 = cache.generateKey('Hello', 'en', 'fr');
            expect(key1).to.not.equal(key2);
        });

        it('should generate unique keys for different services', () => {
            const key1 = cache.generateKey('Hello', 'en', 'es', 'deepl');
            const key2 = cache.generateKey('Hello', 'en', 'es', 'google');
            expect(key1).to.not.equal(key2);
        });

        it('should include options in key generation', () => {
            const key1 = cache.generateKey('Hello', 'en', 'es', 'deepl', { formality: 'formal' });
            const key2 = cache.generateKey('Hello', 'en', 'es', 'deepl', { formality: 'informal' });
            expect(key1).to.not.equal(key2);
        });
    });

    describe('set and get', () => {
        it('should store and retrieve translations', async () => {
            const text = 'Hello world';
            const fromLang = 'en';
            const toLang = 'es';
            const service = 'deepl';
            const result = {
                translation: 'Hola mundo',
                confidence: 0.95
            };

            await cache.set(text, fromLang, toLang, service, result);

            const cached = await cache.get(text, fromLang, toLang, service);
            expect(cached).to.deep.equal(result);
        });

        it('should also store service-agnostic entries', async () => {
            const text = 'Hello world';
            const fromLang = 'en';
            const toLang = 'es';
            const service = 'deepl';
            const result = {
                translation: 'Hola mundo',
                confidence: 0.95
            };

            await cache.set(text, fromLang, toLang, service, result);

            // Should be retrievable with 'any' service
            const cached = await cache.get(text, fromLang, toLang, 'any');
            expect(cached).to.deep.equal(result);
        });

        it('should return null for non-existent entries', async () => {
            const cached = await cache.get('Not in cache', 'en', 'es', 'deepl');
            expect(cached).to.be.null;
        });

        it('should update stats when retrieving entries', async () => {
            // First access (miss)
            await cache.get('Not in cache', 'en', 'es', 'deepl');
            expect(cache.stats.totalRequests).to.equal(1);
            expect(cache.stats.misses).to.equal(1);
            expect(cache.stats.hits).to.equal(0);

            // Add to cache
            await cache.set('Hello', 'en', 'es', 'deepl', { translation: 'Hola' });

            // Second access (hit)
            await cache.get('Hello', 'en', 'es', 'deepl');
            expect(cache.stats.totalRequests).to.equal(2);
            expect(cache.stats.misses).to.equal(1);
            expect(cache.stats.hits).to.equal(1);
        });

        it('should respect expiry times', async () => {
            // Set with a very short expiry (1ms)
            await cache.set('Hello', 'en', 'es', 'deepl', { translation: 'Hola' }, 0.001);

            // Wait for expiry
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should return null after expiry
            const cached = await cache.get('Hello', 'en', 'es', 'deepl');
            expect(cached).to.be.null;
            expect(cache.stats.misses).to.equal(1);
        });
    });

    describe('pruneCache', () => {
        it('should remove expired entries', async () => {
            // Add some entries with very short expiry
            await cache.set('Entry1', 'en', 'es', 'deepl', { translation: 'Test1' }, 0.001);
            await cache.set('Entry2', 'en', 'es', 'deepl', { translation: 'Test2' }, 0.001);

            // Wait for expiry
            await new Promise(resolve => setTimeout(resolve, 10));

            // Prune cache
            cache.pruneCache();

            // Should be removed
            const cached1 = await cache.get('Entry1', 'en', 'es', 'deepl');
            const cached2 = await cache.get('Entry2', 'en', 'es', 'deepl');
            expect(cached1).to.be.null;
            expect(cached2).to.be.null;
        });

        it('should respect maxCacheSize', async () => {
            // Cache is configured with maxCacheSize of 10

            // Add 15 entries (exceeds maxCacheSize)
            for (let i = 0; i < 15; i++) {
                await cache.set(`Entry${i}`, 'en', 'es', 'deepl', { translation: `Test${i}` });
            }

            // Cache should prune automatically
            expect(cache.cache.size).to.be.at.most(10);
        });
    });

    describe('getStats', () => {
        it('should return accurate statistics', async () => {
            // Add some cache hits and misses
            await cache.get('Miss1', 'en', 'es', 'deepl');
            await cache.get('Miss2', 'en', 'es', 'deepl');

            await cache.set('Hit1', 'en', 'es', 'deepl', { translation: 'Test1' });
            await cache.get('Hit1', 'en', 'es', 'deepl');

            await cache.set('Hit2', 'en', 'es', 'deepl', { translation: 'Test2' });
            await cache.get('Hit2', 'en', 'es', 'deepl');

            const stats = cache.getStats();

            expect(stats.hits).to.equal(2);
            expect(stats.misses).to.equal(2);
            expect(stats.totalRequests).to.equal(4);
            expect(stats.size).to.be.greaterThan(0);
            expect(stats.hitRate).to.equal(0.5); // 2 hits out of 4 requests
        });
    });

    describe('clear', () => {
        it('should remove all entries', async () => {
            // Add some entries
            await cache.set('Entry1', 'en', 'es', 'deepl', { translation: 'Test1' });
            await cache.set('Entry2', 'en', 'es', 'deepl', { translation: 'Test2' });

            // Verify they exist
            expect(await cache.get('Entry1', 'en', 'es', 'deepl')).to.not.be.null;
            expect(await cache.get('Entry2', 'en', 'es', 'deepl')).to.not.be.null;

            // Clear cache
            await cache.clear();

            // Verify they're gone
            expect(await cache.get('Entry1', 'en', 'es', 'deepl')).to.be.null;
            expect(await cache.get('Entry2', 'en', 'es', 'deepl')).to.be.null;
            expect(cache.cache.size).to.equal(0);
        });
    });

    describe('edge cases', () => {
        it('should handle empty text', async () => {
            await cache.set('', 'en', 'es', 'deepl', { translation: '' });
            const cached = await cache.get('', 'en', 'es', 'deepl');
            expect(cached).to.deep.equal({ translation: '' });
        });

        it('should handle special characters', async () => {
            const text = 'Special: !@#$%^&*()_+{}[]|\\:;"\'<>,.?/';
            const result = { translation: 'Translated special chars' };

            await cache.set(text, 'en', 'es', 'deepl', result);
            const cached = await cache.get(text, 'en', 'es', 'deepl');
            expect(cached).to.deep.equal(result);
        });

        it('should handle very long text', async () => {
            // Generate a long string
            const longText = 'A'.repeat(10000);
            const result = { translation: 'Long text translation' };

            await cache.set(longText, 'en', 'es', 'deepl', result);
            const cached = await cache.get(longText, 'en', 'es', 'deepl');
            expect(cached).to.deep.equal(result);
        });
    });
});
