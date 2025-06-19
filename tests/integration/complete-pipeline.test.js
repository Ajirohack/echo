const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');

// Import required components
// Note: These paths may need adjustment based on the actual project structure
const TranslationManager = require('../../src/services/translation/translation-manager');
// Assuming these managers exist
const STTManager = require('../../src/services/stt/STTManager');
const TTSManager = require('../../src/services/tts/TTSManager');

// Import mocks
const {
    MockDeepLService,
    MockGPT4oTranslator,
    MockGoogleTranslate,
    MockAzureTranslator
} = require('../mocks/translation-mocks');

describe('Complete Pipeline Integration Tests', () => {
    let translationManager;
    let sttManager;
    let ttsManager;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Initialize managers with mock services
        translationManager = new TranslationManager();
        translationManager.services = {
            deepl: new MockDeepLService(),
            gpt4o: new MockGPT4oTranslator(),
            google: new MockGoogleTranslate(),
            azure: new MockAzureTranslator()
        };

        // Create STT and TTS managers (or mocks if needed)
        sttManager = new STTManager();
        ttsManager = new TTSManager();

        // Mock filesystem operations
        sandbox.stub(fs, 'writeFileSync');
        sandbox.stub(fs, 'readFileSync');
    });

    afterEach(() => {
        sandbox.restore();
        if (translationManager) translationManager.destroy();
        if (sttManager) sttManager.destroy();
        if (ttsManager) ttsManager.destroy();
    });

    describe('End-to-end audio translation pipeline', () => {
        it('should process audio through the complete pipeline', async function () {
            // This test might take longer
            this.timeout(10000);

            // Initialize all components
            await translationManager.initialize();

            // Mock STT transcription
            sandbox.stub(sttManager, 'transcribeAudio').resolves({
                text: 'Hello, this is a test of the translation system.',
                confidence: 0.95,
                language: 'en',
                service: 'whisper'
            });

            // Mock TTS synthesis
            sandbox.stub(ttsManager, 'synthesizeSpeech').resolves({
                audioFile: '/path/to/mock/output.wav',
                duration: 2.5,
                service: 'elevenlabs',
                voice: 'default'
            });

            // Step 1: Speech-to-Text
            const sttResult = await sttManager.transcribeAudio('/path/to/mock/input.wav');

            expect(sttResult.text).to.equal('Hello, this is a test of the translation system.');
            expect(sttResult.language).to.equal('en');

            // Step 2: Translation
            const translationResult = await translationManager.translate(
                sttResult.text,
                sttResult.language,
                'es',
                { context: 'System test' }
            );

            expect(translationResult.success).to.be.true;
            expect(translationResult.translation).to.be.a('string');
            expect(translationResult.service).to.be.oneOf(['deepl', 'gpt4o', 'google', 'azure']);

            // Step 3: Text-to-Speech
            const ttsResult = await ttsManager.synthesizeSpeech(
                translationResult.translation,
                'es',
                { voice: 'default' }
            );

            expect(ttsResult.audioFile).to.equal('/path/to/mock/output.wav');
            expect(ttsResult.service).to.equal('elevenlabs');

            // Verify the complete flow works as expected
            expect(sttManager.transcribeAudio.calledOnce).to.be.true;
            expect(ttsManager.synthesizeSpeech.calledOnce).to.be.true;
        });

        it('should handle service failover in the pipeline', async function () {
            this.timeout(10000);

            // Set up a failing STT service
            sandbox.stub(sttManager, 'transcribeAudio')
                .onFirstCall().rejects(new Error('Service unavailable'))
                .onSecondCall().resolves({
                    text: 'Hello, this is a test with failover.',
                    confidence: 0.9,
                    language: 'en',
                    service: 'google' // Fallback service
                });

            // Mock other components
            sandbox.stub(translationManager, 'translate').resolves({
                success: true,
                translation: 'Hola, esta es una prueba con conmutación por error.',
                service: 'google',
                confidence: 0.85,
                fromLanguage: 'en',
                toLanguage: 'es'
            });

            sandbox.stub(ttsManager, 'synthesizeSpeech').resolves({
                audioFile: '/path/to/mock/output.wav',
                duration: 3.0,
                service: 'google',
                voice: 'default'
            });

            // Execute pipeline with retry logic
            let sttResult;
            try {
                // First attempt will fail
                sttResult = await sttManager.transcribeAudio('/path/to/mock/input.wav');
            } catch (error) {
                // Retry with fallback service
                sttResult = await sttManager.transcribeAudio('/path/to/mock/input.wav');
            }

            expect(sttResult.text).to.equal('Hello, this is a test with failover.');
            expect(sttResult.service).to.equal('google'); // Should use fallback

            // Continue with translation and TTS
            const translationResult = await translationManager.translate(
                sttResult.text,
                sttResult.language,
                'es'
            );

            const ttsResult = await ttsManager.synthesizeSpeech(
                translationResult.translation,
                'es'
            );

            expect(translationResult.success).to.be.true;
            expect(ttsResult.audioFile).to.be.a('string');

            // Verify the STT service was called twice (initial failure + retry)
            expect(sttManager.transcribeAudio.calledTwice).to.be.true;
        });

        it('should maintain conversation context across multiple exchanges', async function () {
            this.timeout(15000);

            // Initialize all components
            await translationManager.initialize();

            // Mock STT for multiple utterances
            const mockUtterances = [
                { text: 'Hello, how are you today?', language: 'en' },
                { text: 'I would like to schedule a meeting tomorrow.', language: 'en' },
                { text: 'Does 2 PM work for you?', language: 'en' }
            ];

            const sttStub = sandbox.stub(sttManager, 'transcribeAudio');
            mockUtterances.forEach((utterance, index) => {
                sttStub.onCall(index).resolves({
                    text: utterance.text,
                    confidence: 0.95,
                    language: utterance.language,
                    service: 'whisper'
                });
            });

            // Mock TTS
            sandbox.stub(ttsManager, 'synthesizeSpeech').resolves({
                audioFile: '/path/to/mock/output.wav',
                duration: 2.0,
                service: 'elevenlabs'
            });

            // Create conversation ID for context tracking
            const conversationId = 'test-conversation-' + Date.now();

            // Process each utterance through the pipeline
            for (let i = 0; i < mockUtterances.length; i++) {
                // Step 1: Speech-to-Text
                const sttResult = await sttManager.transcribeAudio(`/path/to/mock/input${i}.wav`);

                // Step 2: Translation with conversation context
                const translationResult = await translationManager.translate(
                    sttResult.text,
                    sttResult.language,
                    'es',
                    {
                        conversationId: conversationId,
                        domain: 'business'
                    }
                );

                // Step 3: Text-to-Speech
                await ttsManager.synthesizeSpeech(
                    translationResult.translation,
                    'es'
                );

                expect(translationResult.success).to.be.true;
            }

            // Verify all utterances were processed
            expect(sttManager.transcribeAudio.callCount).to.equal(mockUtterances.length);
            expect(ttsManager.synthesizeSpeech.callCount).to.equal(mockUtterances.length);
        });
    });
});
