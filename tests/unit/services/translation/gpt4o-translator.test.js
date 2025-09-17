// Jest functionality for testing
const axios = require('axios');
const GPT4oTranslator = require('../../../../src/services/translation/gpt4o-translator');

// Mock OpenAI
jest.mock('openai', () => {
    return {
        OpenAI: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: jest.fn()
                }
            }
        }))
    };
});

describe('GPT4oTranslator', () => {
    let translator;

    beforeEach(() => {
        jest.clearAllMocks();
        translator = new GPT4oTranslator({
            apiKey: 'test-api-key',
            model: 'gpt-4o',
            temperature: 0.1
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully with valid API key', async () => {
            const translator = new GPT4oTranslator({ apiKey: 'test-key' });
            
            // Mock the testConnection method
            jest.spyOn(translator, 'testConnection').mockResolvedValue(true);
            jest.spyOn(translator, 'loadCulturalProfiles').mockImplementation(() => {});
            
            const result = await translator.initialize();
            
            expect(result.success).toBe(true);
            expect(result.model).toBe('gpt-4o');
            expect(translator.isInitialized).toBe(true);
        });

        it('should handle missing API key', async () => {
            // Clear environment variable
            delete process.env.OPENAI_API_KEY;
            const translator = new GPT4oTranslator();
            
            await expect(translator.initialize()).rejects.toThrow();
        });
    });

    describe('translate', () => {
        beforeEach(async () => {
            // Setup initialized translator
            translator.isInitialized = true;
            translator.openai = {
                chat: {
                    completions: {
                        create: jest.fn()
                    }
                }
            };

            // Mock cultural profiles
            translator.culturalProfiles = new Map();
            translator.culturalProfiles.set('default', {
                tone: 'balanced',
                formality: 'neutral',
                culturalNotes: 'Balance accuracy with natural flow in target language.',
                prioritizeAccuracy: true
            });

            // Mock loadCulturalProfiles
            jest.spyOn(translator, 'loadCulturalProfiles').mockImplementation(() => {});
        });

        it('should translate text successfully', async () => {
            const translator = new GPT4oTranslator({ apiKey: 'test-key' });
            
            // Mock cultural profiles
            translator.culturalProfiles = new Map();
            translator.culturalProfiles.set('default', {
                tone: 'balanced',
                formality: 'neutral',
                culturalNotes: 'Balance accuracy with natural flow in target language.',
                prioritizeAccuracy: true
            });
            
            // Mock OpenAI response
            const mockCreate = jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'Hola mundo' } }],
                usage: { total_tokens: 15 }
            });
            
            // Set up the mock
            translator.openai = {
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            };
            
            // Mock loadCulturalProfiles and set initialized state
            jest.spyOn(translator, 'loadCulturalProfiles').mockImplementation(() => {});
            translator.isInitialized = true;
            
            const result = await translator.translate('Hello world', 'en', 'es');
            
            expect(result.translation).toBe('Hola mundo');
            expect(result.fromLanguage).toBe('en');
            expect(result.toLanguage).toBe('es');
        });

        it('should handle API errors gracefully', async () => {
            const translator = new GPT4oTranslator({ apiKey: 'test-key' });
            
            // Mock cultural profiles
            translator.culturalProfiles = new Map();
            translator.culturalProfiles.set('default', {
                tone: 'balanced',
                formality: 'neutral',
                culturalNotes: 'Balance accuracy with natural flow in target language.',
                prioritizeAccuracy: true
            });
            
            // Mock API error
            const mockCreate = jest.fn().mockRejectedValue(new Error('Rate limit exceeded'));
            
            translator.openai = {
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            };
            
            translator.isInitialized = true;

            await expect(translator.translate('Hello world', 'en', 'es')).rejects.toThrow('Rate limit exceeded');
        });

        it('should handle malformed API responses', async () => {
            const translator = new GPT4oTranslator({ apiKey: 'test-key' });
            
            // Mock cultural profiles
            translator.culturalProfiles = new Map();
            translator.culturalProfiles.set('default', {
                tone: 'balanced',
                formality: 'neutral',
                culturalNotes: 'Balance accuracy with natural flow in target language.',
                prioritizeAccuracy: true
            });
            
            // Mock response that will cause an actual error (missing choices)
            const mockCreate = jest.fn().mockResolvedValue({
                usage: { total_tokens: 10 }
            });
            
            translator.openai = {
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            };
            
            translator.isInitialized = true;

            await expect(translator.translate('Hello world', 'en', 'es')).rejects.toThrow();
        });

        it('should update conversation context when provided', async () => {
            const translator = new GPT4oTranslator({ apiKey: 'test-key' });
            
            // Mock cultural profiles
            translator.culturalProfiles = new Map();
            translator.culturalProfiles.set('default', {
                tone: 'balanced',
                formality: 'neutral',
                culturalNotes: 'Balance accuracy with natural flow in target language.',
                prioritizeAccuracy: true
            });
            
            // Mock successful translation
            const mockCreate = jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'Hola mundo' } }],
                usage: { total_tokens: 15 }
            });
            
            translator.openai = {
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            };
            
            translator.isInitialized = true;

            // Mock the updateConversationContext method
            const updateContextSpy = jest.spyOn(translator, 'updateConversationContext').mockImplementation(() => {});

            await translator.translate('Hello world', 'en', 'es', {
                conversationId: 'test-conversation'
            });

            expect(updateContextSpy).toHaveBeenCalledTimes(1);
            expect(updateContextSpy).toHaveBeenCalledWith('test-conversation', 'Hello world', 'Hola mundo', 'en', 'es');
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
            jest.spyOn(translator, 'getConversationContext').mockReturnValue('Previous: Hello -> Hola');

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

            expect(systemPrompt).toContain('professional translator');
            expect(systemPrompt).toContain('Business meeting context');
            expect(systemPrompt).toContain('TRANSLATION REQUIREMENTS');
            expect(systemPrompt).toContain('professional'); // tone
            expect(systemPrompt).toContain('formal'); // formality
            expect(userPrompt).toContain('Translate this en text to es');
            expect(userPrompt).toContain('How are you today?');
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

            expect(systemPrompt).toContain('balanced'); // tone
            expect(systemPrompt).toContain('neutral'); // formality
            expect(systemPrompt).toContain('Balance accuracy with natural flow');
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

            expect(translator.conversationContexts.has('test-conversation')).toBe(true);
            const context = translator.conversationContexts.get('test-conversation');
            expect(context.length).toBe(1);
            expect(context[0].original).toBe('Hello');
            expect(context[0].translated).toBe('Hola');
        });

        it('should limit context size to configured window', () => {
            // Initialize conversation with existing entries
            translator.conversationContexts = new Map();
            translator.config.contextWindowSize = 2;

            // Add entries to exceed the limit (contextWindowSize * 2 = 4)
            const existingContext = [
                {
                    timestamp: Date.now() - 5000,
                    original: 'First',
                    translated: 'Primero',
                    fromLanguage: 'en',
                    toLanguage: 'es'
                },
                {
                    timestamp: Date.now() - 4000,
                    original: 'Second',
                    translated: 'Segundo',
                    fromLanguage: 'en',
                    toLanguage: 'es'
                },
                {
                    timestamp: Date.now() - 3000,
                    original: 'Third',
                    translated: 'Tercero',
                    fromLanguage: 'en',
                    toLanguage: 'es'
                },
                {
                    timestamp: Date.now() - 2000,
                    original: 'Fourth',
                    translated: 'Cuarto',
                    fromLanguage: 'en',
                    toLanguage: 'es'
                }
            ];

            translator.conversationContexts.set('test-conversation', existingContext);

            // Add a new entry that should trigger trimming
            translator.updateConversationContext(
                'test-conversation',
                'Fifth',
                'Quinto',
                'en',
                'es'
            );

            // Should keep only the last contextWindowSize entries (2)
            const context = translator.conversationContexts.get('test-conversation');
            expect(context.length).toBe(2);
            expect(context[0].original).toBe('Fourth');
            expect(context[1].original).toBe('Fifth');
        });
    });
});
