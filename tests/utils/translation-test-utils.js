/**
 * Test utilities for translation tests
 */

const fs = require('fs');
const path = require('path');
// Sinon functionality replaced with Jest mocks

/**
 * Load test data from fixtures
 * 
 * @param {string} filename - Fixture filename
 * @returns {object} Test data
 */
function loadTestData(filename) {
    const filePath = path.join(__dirname, '..', 'fixtures', 'test-data', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Load mock API responses
 * 
 * @param {string} filename - Mock response filename
 * @returns {object} Mock responses
 */
function loadMockResponses(filename) {
    const filePath = path.join(__dirname, '..', 'fixtures', 'mock-responses', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Create a mock translation service factory
 * 
 * @param {object} options - Configuration options
 * @returns {object} Mock service factory
 */
function createMockServices(options = {}) {
    const {
        deepl = { healthy: true, failureRate: 0 },
        gpt4o = { healthy: true, failureRate: 0 },
        google = { healthy: true, failureRate: 0 },
        azure = { healthy: true, failureRate: 0 }
    } = options;

    const mockServices = {};

    if (deepl) {
        const MockDeepLService = require('../mocks/translation-mocks').MockDeepLService;
        mockServices.deepl = new MockDeepLService({ failureRate: deepl.failureRate });
    }

    if (gpt4o) {
        const MockGPT4oTranslator = require('../mocks/translation-mocks').MockGPT4oTranslator;
        mockServices.gpt4o = new MockGPT4oTranslator({ failureRate: gpt4o.failureRate });
    }

    if (google) {
        const MockGoogleTranslate = require('../mocks/translation-mocks').MockGoogleTranslate;
        mockServices.google = new MockGoogleTranslate({ failureRate: google.failureRate });
    }

    if (azure) {
        const MockAzureTranslator = require('../mocks/translation-mocks').MockAzureTranslator;
        mockServices.azure = new MockAzureTranslator({ failureRate: azure.failureRate });
    }

    return mockServices;
}

/**
 * Create a sandbox with common stubs for testing
 * 
 * @param {object} options - Configuration options
 * @returns {object} Sinon sandbox with stubs
 */
function createTestSandbox(options = {}) {
    const sandbox = sinon.createSandbox();

    // Common stubs
    if (options.stubFs) {
        sandbox.stub(fs, 'writeFileSync');
        sandbox.stub(fs, 'readFileSync').callsFake((path, encoding) => {
            if (path.endsWith('.json')) {
                return JSON.stringify({});
            }
            return '';
        });
    }

    return sandbox;
}

/**
 * Delay execution for testing
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    loadTestData,
    loadMockResponses,
    createMockServices,
    createTestSandbox,
    delay
};
