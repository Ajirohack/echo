/**
 * Security tests for API key handling
 */

const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

// Import the API key manager
const ApiKeyManager = require('../../src/services/security/api-key-manager');

describe('API Key Security', () => {
    let apiKeyManager;
    let sandbox;
    let mockConfig;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Mock fs functions
        sandbox.stub(fs, 'readFileSync');
        sandbox.stub(fs, 'writeFileSync');
        sandbox.stub(fs, 'existsSync').returns(true);

        // Mock encryption/decryption functions
        mockConfig = {
            encryptionKey: 'test-encryption-key',
            configDir: '/mock/config/dir'
        };

        apiKeyManager = new ApiKeyManager(mockConfig);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('API key storage', () => {
        it('should encrypt API keys before storing', () => {
            // Set up test data
            const serviceId = 'deepl';
            const apiKey = 'test-api-key-12345';

            // Call store API key
            apiKeyManager.storeApiKey(serviceId, apiKey);

            // Check that writeFileSync was called with encrypted data
            expect(fs.writeFileSync.calledOnce).to.be.true;

            const writeCall = fs.writeFileSync.firstCall;
            const encryptedData = writeCall.args[1];

            // Verify data is encrypted (not plain text)
            expect(encryptedData).to.not.include(apiKey);
        });

        it('should store API keys in the correct location', () => {
            // Set up test data
            const serviceId = 'deepl';
            const apiKey = 'test-api-key-12345';

            // Call store API key
            apiKeyManager.storeApiKey(serviceId, apiKey);

            // Check that the file path is correct
            const expectedPath = path.join(mockConfig.configDir, `${serviceId}.key`);
            expect(fs.writeFileSync.firstCall.args[0]).to.equal(expectedPath);
        });

        it('should not store API keys in plain text', () => {
            // Set up test data
            const serviceId = 'deepl';
            const apiKey = 'test-api-key-12345';

            // Spy on console to check for logging
            const consoleSpy = sandbox.spy(console, 'log');

            // Call store API key
            apiKeyManager.storeApiKey(serviceId, apiKey);

            // Verify key is not logged
            expect(consoleSpy.neverCalledWith(sinon.match(apiKey))).to.be.true;
        });
    });

    describe('API key retrieval', () => {
        it('should decrypt API keys when retrieving', () => {
            // Set up test data
            const serviceId = 'deepl';
            const apiKey = 'test-api-key-12345';

            // Mock encryption and decryption
            apiKeyManager.encryptData = sandbox.stub().returns('encrypted-data');
            apiKeyManager.decryptData = sandbox.stub().returns(apiKey);

            // Mock readFileSync to return encrypted data
            fs.readFileSync.returns('encrypted-data');

            // Call retrieve API key
            const retrievedKey = apiKeyManager.getApiKey(serviceId);

            // Check that decryption was called
            expect(apiKeyManager.decryptData.calledOnce).to.be.true;
            expect(retrievedKey).to.equal(apiKey);
        });

        it('should handle missing API keys gracefully', () => {
            // Mock file not existing
            fs.existsSync.returns(false);

            // Call retrieve API key for non-existent service
            const retrievedKey = apiKeyManager.getApiKey('nonexistent-service');

            // Should return null, not throw
            expect(retrievedKey).to.be.null;
        });

        it('should handle decryption errors securely', () => {
            // Mock readFileSync to return data
            fs.readFileSync.returns('corrupted-data');

            // Mock decryption to throw error
            apiKeyManager.decryptData = sandbox.stub().throws(new Error('Decryption failed'));

            // Call retrieve API key
            try {
                apiKeyManager.getApiKey('deepl');
                expect.fail('Should have thrown an error');
            } catch (error) {
                // Should throw a generic error without exposing sensitive info
                expect(error.message).to.not.include('corrupted-data');
                expect(error.message).to.include('retrieve API key');
            }
        });
    });

    describe('API key validation', () => {
        it('should validate API key format', () => {
            // Valid API keys
            expect(apiKeyManager.isValidApiKeyFormat('deepl', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')).to.be.true;
            expect(apiKeyManager.isValidApiKeyFormat('gpt4o', 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).to.be.true;

            // Invalid API keys
            expect(apiKeyManager.isValidApiKeyFormat('deepl', 'invalid-format')).to.be.false;
            expect(apiKeyManager.isValidApiKeyFormat('gpt4o', 'invalid-format')).to.be.false;
        });

        it('should detect potentially compromised API keys', () => {
            // Set up mock compromised key database
            apiKeyManager.compromisedKeyHashes = new Set(['hash-of-compromised-key']);
            apiKeyManager.hashApiKey = sandbox.stub().returns('hash-of-compromised-key');

            // Should detect compromised key
            expect(apiKeyManager.isCompromisedApiKey('compromised-key')).to.be.true;

            // Change hash result for safe key
            apiKeyManager.hashApiKey.returns('hash-of-safe-key');

            // Should not flag safe key
            expect(apiKeyManager.isCompromisedApiKey('safe-key')).to.be.false;
        });
    });

    describe('API key rotation', () => {
        it('should support API key rotation', async () => {
            // Set up test data
            const serviceId = 'deepl';
            const oldApiKey = 'old-api-key';
            const newApiKey = 'new-api-key';

            // Mock API key storage
            apiKeyManager.storeApiKey = sandbox.spy();
            apiKeyManager.getApiKey = sandbox.stub().returns(oldApiKey);

            // Mock service client
            const mockServiceClient = {
                validateApiKey: sandbox.stub().resolves(true)
            };

            // Call rotate API key
            await apiKeyManager.rotateApiKey(serviceId, newApiKey, mockServiceClient);

            // Should store new key
            expect(apiKeyManager.storeApiKey.calledWith(serviceId, newApiKey)).to.be.true;

            // Should validate new key
            expect(mockServiceClient.validateApiKey.calledWith(newApiKey)).to.be.true;
        });

        it('should not store invalid API keys during rotation', async () => {
            // Set up test data
            const serviceId = 'deepl';
            const oldApiKey = 'old-api-key';
            const invalidApiKey = 'invalid-api-key';

            // Mock API key storage
            apiKeyManager.storeApiKey = sandbox.spy();
            apiKeyManager.getApiKey = sandbox.stub().returns(oldApiKey);

            // Mock service client with validation failure
            const mockServiceClient = {
                validateApiKey: sandbox.stub().resolves(false)
            };

            // Call rotate API key
            try {
                await apiKeyManager.rotateApiKey(serviceId, invalidApiKey, mockServiceClient);
                expect.fail('Should have thrown an error');
            } catch (error) {
                // Should not store invalid key
                expect(apiKeyManager.storeApiKey.neverCalledWith(serviceId, invalidApiKey)).to.be.true;
            }
        });
    });
});

describe('App Security', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Input sanitization', () => {
        it('should sanitize user inputs to prevent injection attacks', () => {
            // Import the sanitization module
            const { sanitizeInput } = require('../../src/services/security/input-sanitizer');

            // Test potentially malicious inputs
            const malicious = '<script>alert("XSS")</script>';
            const sanitized = sanitizeInput(malicious);

            // Should remove script tags
            expect(sanitized).to.not.include('<script>');
        });

        it('should sanitize file paths to prevent path traversal', () => {
            // Import the sanitization module
            const { sanitizePath } = require('../../src/services/security/input-sanitizer');

            // Test potentially malicious paths
            const malicious = '../../../etc/passwd';
            const sanitized = sanitizePath(malicious);

            // Should remove directory traversal
            expect(sanitized).to.not.include('../');
        });
    });

    describe('Content Security Policy', () => {
        it('should validate CSP headers', () => {
            // Import the CSP module
            const { getCSPHeaders } = require('../../src/services/security/content-security');

            const headers = getCSPHeaders();

            // Should have required CSP directives
            expect(headers['Content-Security-Policy']).to.include("default-src 'self'");
            expect(headers['Content-Security-Policy']).to.include("script-src 'self'");
        });
    });

    describe('Secure storage', () => {
        it('should use secure storage for sensitive data', () => {
            // Import the secure storage module
            const SecureStorage = require('../../src/services/security/secure-storage');

            const secureStorage = new SecureStorage();

            // Test storing sensitive data
            const testData = { username: 'test', password: 'secret' };
            secureStorage.storeSecurely('credentials', testData);

            // Verify data is not stored in plain text
            const storedData = secureStorage.retrieveSecurely('credentials');

            // Data should be retrieved correctly
            expect(storedData).to.deep.equal(testData);

            // But internal storage should be encrypted
            expect(JSON.stringify(secureStorage.storage)).to.not.include('secret');
        });
    });
});

describe('Network Security', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('HTTPS verification', () => {
        it('should verify HTTPS certificates by default', () => {
            // Import the HTTP client
            const HttpClient = require('../../src/services/network/http-client');

            // Create client
            const client = new HttpClient();

            // Check default config
            expect(client.config.rejectUnauthorized).to.be.true;
        });

        it('should detect and prevent SSL stripping', () => {
            // Import the HTTP client
            const HttpClient = require('../../src/services/network/http-client');

            // Create client
            const client = new HttpClient();

            // Mock request options
            const options = {
                url: 'http://api.example.com', // Non-HTTPS URL
            };

            // Should throw error for non-HTTPS URLs
            expect(() => client.get(options)).to.throw(/HTTPS required/);
        });
    });

    describe('Authentication header handling', () => {
        it('should safely handle authentication headers', () => {
            // Import the HTTP client
            const HttpClient = require('../../src/services/network/http-client');

            // Create client
            const client = new HttpClient();

            // Mock logging function
            const originalLog = console.log;
            const logs = [];
            console.log = (message) => logs.push(message);

            // Make request with auth header
            client.get({
                url: 'https://api.example.com',
                headers: {
                    'Authorization': 'Bearer secret-token-value'
                }
            }).catch(() => { }); // Ignore actual network error

            // Restore console.log
            console.log = originalLog;

            // Check that auth header value is not logged
            const hasAuthHeaderValue = logs.some(log => log.includes('secret-token-value'));
            expect(hasAuthHeaderValue).to.be.false;
        });
    });
});
