const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const GPT4oTranslator = require('../../../../src/services/translation/gpt4o-translator');

describe('GPT4oTranslator', () => {
    let translator;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        translator = new GPT4oTranslator({
            apiKey: 'test-api-key',
            model: 'gpt-4o',
            temperature: 0.1
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should initialize successfully with valid API key', async () => {
            // Mock the OpenAI constructor and client methods
            const mockOpenAI = {
                chat: {
                    completions: {
                        create: sandbox.stub().resolves({
                            id: 'test-completion-id',
                            choices: [{ message: { content: 'Test response' } }],
                            usage: { total_tokens: 10 }
                        })
                    }
                }
            };

            global.OpenAI = sandbox.stub().returns(mockOpenAI);

            const result = await translator.initialize();

            expect(result.success).to.be.true;
            expect(translator.isInitialized).to.be.true;
            expect(translator.openai).to.equal(mockOpenAI);
        });

        it('should handle missing API key', async () => {
            translator = new GPT4oTranslator({ apiKey: null });

            try {
                await translator.initialize();
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('API key');
            }
        });
    });

    describe('translate', () => {
        beforeEach(async () => {
            // Setup initialized translator
            translator.isInitialized = true;
            translator.openai = {
                chat: {
                    completions: {
                        create: sandbox.stub()
                    }
                }
            };

            // Mock loadCulturalProfiles
            sandbox.stub(translator, 'loadCulturalProfiles');
        });

        it('should translate text successfully', async () => {
            // Mock successful translation response
            const mockCompletion = {
                id: 'test-completion-id',
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                translation: 'Hola mundo',
                                confidence: 0.95,
                                reasoning: 'Simple translation of a common phrase',
                                alternatives: ['Saludos mundo'],
                                formality: 'neutral',
                                cultural_notes: 'Standard greeting'
                            })
                        }
                    }
                ],
                usage: {
                    total_tokens: 25
                }
            };

            translator.openai.chat.completions.create.resolves(mockCompletion);

            const result = await translator.translate('Hello world', 'en', 'es');

            expect(result.translation).to.equal('Hola mundo');
            expect(result.confidence).to.equal(0.95);
            expect(result.service).to.equal('gpt4o');
            expect(result.alternatives).to.deep.equal(['Saludos mundo']);
            expect(translator.openai.chat.completions.create.calledOnce).to.be.true;
        });

        it('should handle API errors gracefully', async () => {
            // Mock API error
            translator.openai.chat.completions.create.rejects(
                new Error('Rate limit exceeded')
            );

            try {
                await translator.translate('Hello world', 'en', 'es');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Rate limit exceeded');
            }
        });

        it('should handle malformed API responses', async () => {
            // Mock invalid JSON response
            const mockCompletion = {
                id: 'test-completion-id',
                choices: [
                    {
                        message: {
                            content: 'This is not valid JSON'
                        }
                    }
                ],
                usage: {
                    total_tokens: 10
                }
            };

            translator.openai.chat.completions.create.resolves(mockCompletion);

            try {
                await translator.translate('Hello world', 'en', 'es');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Failed to parse translation response');
            }
        });

        it('should update conversation context when provided', async () => {
            // Mock successful translation
            const mockCompletion = {
                id: 'test-completion-id',
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                translation: 'Hola mundo',
                                confidence: 0.95
                            })
                        }
                    }
                ],
                usage: {
                    total_tokens: 15
                }
            };

            translator.openai.chat.completions.create.resolves(mockCompletion);

            // Mock the updateConversationContext method
            const updateContextSpy = sandbox.spy(translator, 'updateConversationContext');

            await translator.translate('Hello world', 'en', 'es', {
                conversationId: 'test-conversation'
            });

            expect(updateContextSpy.calledOnce).to.be.true;
            expect(updateContextSpy.args[0][0]).to.equal('test-conversation');
            expect(updateContextSpy.args[0][1]).to.equal('Hello world');
            expect(updateContextSpy.args[0][2]).to.equal('Hola mundo');
        });
    });

    describe('buildTranslationContext', () => {
        beforeEach(() => {
            // Setup cultural profiles
            translator.culturalProfiles = new Map();
            translator.culturalProfiles.set('default', {
                tone: 'balanced',
                formality: 'neutral',
                culturalNotes: 'Balance accuracy with natural flow in target language.',
                prioritizeAccuracy: true
            });
            translator.culturalProfiles.set('business', {
                tone: 'professional',
                formality: 'formal',
                culturalNotes: 'Use business terminology, maintain professional tone.',
                prioritizeAccuracy: true
            });
        });

        it('should build appropriate context for translation', () => {
            // Mock getConversationContext
            sandbox.stub(translator, 'getConversationContext').returns('Previous: Hello -> Hola');

            const params = {
                text: 'How are you today?',
                fromLanguage: 'en',
                toLanguage: 'es',
                profile: 'business',
                preserveFormatting: true,
                context: 'Business meeting context',
                conversationId: 'test-conversation'
            };

            const { systemPrompt, userPrompt } = translator.buildTranslationContext(params);

            expect(systemPrompt).to.include('professional translator');
            expect(systemPrompt).to.include('Business meeting context');
            expect(systemPrompt).to.include('TRANSLATION REQUIREMENTS');
            expect(systemPrompt).to.include('professional'); // tone
            expect(systemPrompt).to.include('formal'); // formality
            expect(userPrompt).to.include('Translate this en text to es');
            expect(userPrompt).to.include('How are you today?');
        });

        it('should handle different profiles correctly', () => {
            const params = {
                text: 'Hello world',
                fromLanguage: 'en',
                toLanguage: 'fr',
                profile: 'default',
                preserveFormatting: true
            };

            const { systemPrompt } = translator.buildTranslationContext(params);

            expect(systemPrompt).to.include('balanced'); // tone
            expect(systemPrompt).to.include('neutral'); // formality
            expect(systemPrompt).to.include('Balance accuracy with natural flow');
        });
    });

    describe('updateConversationContext', () => {
        it('should add new entries to conversation context', () => {
            // Initialize empty conversation contexts
            translator.conversationContexts = new Map();
            translator.config.contextWindowSize = 3;

            translator.updateConversationContext(
                'test-conversation',
                'Hello',
                'Hola',
                'en',
                'es'
            );

            expect(translator.conversationContexts.has('test-conversation')).to.be.true;
            const context = translator.conversationContexts.get('test-conversation');
            expect(context.length).to.equal(1);
            expect(context[0].original).to.equal('Hello');
            expect(context[0].translated).to.equal('Hola');
        });

        it('should limit context size to configured window', () => {
            // Initialize conversation with existing entries
            translator.conversationContexts = new Map();
            translator.config.contextWindowSize = 2;

            const existingContext = [
                {
                    timestamp: Date.now() - 3000,
                    original: 'Hello',
                    translated: 'Hola',
                    fromLanguage: 'en',
                    toLanguage: 'es'
                },
                {
                    timestamp: Date.now() - 2000,
                    original: 'How are you?',
                    translated: '¿Cómo estás?',
                    fromLanguage: 'en',
                    toLanguage: 'es'
                }
            ];

            translator.conversationContexts.set('test-conversation', existingContext);

            // Add a new entry
            translator.updateConversationContext(
                'test-conversation',
                'Good morning',
                'Buenos días',
                'en',
                'es'
            );

            // Should keep only the last 2 entries
            const context = translator.conversationContexts.get('test-conversation');
            expect(context.length).to.equal(2);
            expect(context[0].original).to.equal('How are you?');
            expect(context[1].original).to.equal('Good morning');
        });
    });
});
