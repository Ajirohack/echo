const { expect } = require('chai');
const sinon = require('sinon');
const TranslationService = require('../../../../src/services/translation/translation-service');

describe('TranslationService', () => {
    let service;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        service = new TranslationService({
            serviceName: 'test-service',
            apiKey: 'test-api-key'
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should create an instance with the provided config', () => {
            expect(service).to.be.an.instanceOf(TranslationService);
            expect(service.config.serviceName).to.equal('test-service');
            expect(service.config.apiKey).to.equal('test-api-key');
        });

        it('should have default values for non-provided config options', () => {
            expect(service.config.timeout).to.be.a('number');
            expect(service.config.retries).to.be.a('number');
        });
    });

    describe('abstract methods', () => {
        it('should throw error for abstract translate method', async () => {
            try {
                await service.translate('Hello', 'en', 'fr');
                expect.fail('Should have thrown an error');
            } catch (err) {
                expect(err.message).to.include('Method not implemented');
            }
        });

        it('should throw error for abstract detectLanguage method', async () => {
            try {
                await service.detectLanguage('Hello');
                expect.fail('Should have thrown an error');
            } catch (err) {
                expect(err.message).to.include('Method not implemented');
            }
        });
    });

    describe('utility methods', () => {
        it('should format language codes correctly', () => {
            expect(service.formatLanguageCode('en-US')).to.equal('en');
            expect(service.formatLanguageCode('zh-CN')).to.equal('zh');
            expect(service.formatLanguageCode('en')).to.equal('en');
        });
    });
});
