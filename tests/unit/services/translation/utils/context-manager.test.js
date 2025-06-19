/**
 * Unit tests for ContextManager utility
 */

const { expect } = require('chai');
const sinon = require('sinon');
const ContextManager = require('../../../../../src/services/translation/utils/context-manager');

describe('ContextManager', () => {
    let contextManager;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        contextManager = new ContextManager({
            maxContextEntries: 5,
            maxContextAgeMs: 1000 // 1 second for faster testing
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('initialization', () => {
        it('should initialize with default settings', () => {
            const defaultManager = new ContextManager();
            expect(defaultManager.config.maxContextEntries).to.be.greaterThan(0);
            expect(defaultManager.config.maxContextAgeMs).to.be.greaterThan(0);
        });

        it('should initialize with custom settings', () => {
            expect(contextManager.config.maxContextEntries).to.equal(5);
            expect(contextManager.config.maxContextAgeMs).to.equal(1000);
        });

        it('should initialize empty conversation contexts', () => {
            expect(contextManager.conversationContexts).to.be.instanceOf(Map);
            expect(contextManager.conversationContexts.size).to.equal(0);
        });
    });

    describe('addTranslationEntry', () => {
        it('should add entries to the correct conversation', async () => {
            const conversationId = 'conversation1';
            const entry = {
                original: 'Hello',
                translated: 'Hola',
                isSourceToTarget: true
            };

            await contextManager.addTranslationEntry(conversationId, entry);

            expect(contextManager.conversationContexts.has(conversationId)).to.be.true;
            const context = contextManager.conversationContexts.get(conversationId);
            expect(context).to.be.an('array');
            expect(context.length).to.equal(1);
            expect(context[0].original).to.equal('Hello');
            expect(context[0].translated).to.equal('Hola');
            expect(context[0].isSourceToTarget).to.be.true;
            expect(context[0].timestamp).to.be.a('number');
        });

        it('should handle missing conversation ID', async () => {
            // This should not throw
            await contextManager.addTranslationEntry(null, { original: 'Test' });

            // No entry should be added
            expect(contextManager.conversationContexts.size).to.equal(0);
        });

        it('should add multiple entries to the same conversation', async () => {
            const conversationId = 'conversation1';

            await contextManager.addTranslationEntry(conversationId, {
                original: 'Hello',
                translated: 'Hola',
                isSourceToTarget: true
            });

            await contextManager.addTranslationEntry(conversationId, {
                original: 'How are you?',
                translated: '¿Cómo estás?',
                isSourceToTarget: true
            });

            const context = contextManager.conversationContexts.get(conversationId);
            expect(context.length).to.equal(2);
        });

        it('should respect maxContextEntries limit', async () => {
            const conversationId = 'conversation1';

            // Add more entries than the limit (5)
            for (let i = 0; i < 7; i++) {
                await contextManager.addTranslationEntry(conversationId, {
                    original: `Message ${i}`,
                    translated: `Translated ${i}`,
                    isSourceToTarget: true
                });
            }

            const context = contextManager.conversationContexts.get(conversationId);
            expect(context.length).to.equal(5); // Limited to maxContextEntries

            // The oldest entries should be removed first
            expect(context[0].original).to.equal('Message 2');
            expect(context[4].original).to.equal('Message 6');
        });
    });

    describe('getConversationContext', () => {
        it('should return empty string for non-existent conversation', async () => {
            const context = await contextManager.getConversationContext('nonexistent');
            expect(context).to.equal('');
        });

        it('should format context entries correctly', async () => {
            const conversationId = 'conversation1';

            // Add entries with timestamps
            const entry1 = {
                original: 'Hello',
                translated: 'Hola',
                isSourceToTarget: true,
                timestamp: Date.now() - 500 // 500ms ago
            };

            const entry2 = {
                original: 'How are you?',
                translated: '¿Cómo estás?',
                isSourceToTarget: true,
                timestamp: Date.now() - 250 // 250ms ago
            };

            await contextManager.addTranslationEntry(conversationId, entry1);
            await contextManager.addTranslationEntry(conversationId, entry2);

            const context = await contextManager.getConversationContext(conversationId);

            // Context should be a formatted string
            expect(context).to.be.a('string');
            expect(context.length).to.be.greaterThan(0);

            // Should contain both entries
            expect(context).to.include('Hello -> Hola');
            expect(context).to.include('How are you? -> ¿Cómo estás?');
        });

        it('should handle bidirectional conversation correctly', async () => {
            const conversationId = 'conversation1';

            // Add entries with different directions
            await contextManager.addTranslationEntry(conversationId, {
                original: 'Hello',
                translated: 'Hola',
                isSourceToTarget: true // source -> target
            });

            await contextManager.addTranslationEntry(conversationId, {
                original: 'Bien, ¿y tú?',
                translated: 'Good, and you?',
                isSourceToTarget: false // target -> source
            });

            const context = await contextManager.getConversationContext(conversationId);

            // Should show correct direction for each entry
            expect(context).to.include('Hello -> Hola');
            expect(context).to.include('Bien, ¿y tú? <- Good, and you?');
        });
    });

    describe('pruneOldEntries', () => {
        it('should remove entries older than maxContextAgeMs', async () => {
            const conversationId = 'conversation1';

            // Add one older entry and one newer entry
            await contextManager.addTranslationEntry(conversationId, {
                original: 'Old message',
                translated: 'Mensaje antiguo',
                isSourceToTarget: true,
                timestamp: Date.now() - 2000 // 2 seconds ago (older than maxContextAgeMs)
            });

            await contextManager.addTranslationEntry(conversationId, {
                original: 'New message',
                translated: 'Mensaje nuevo',
                isSourceToTarget: true,
                timestamp: Date.now() - 500 // 0.5 seconds ago (newer than maxContextAgeMs)
            });

            // Prune old entries
            contextManager.pruneOldEntries(conversationId);

            const context = contextManager.conversationContexts.get(conversationId);
            expect(context.length).to.equal(1);
            expect(context[0].original).to.equal('New message');
        });

        it('should handle non-existent conversation ID', () => {
            // This should not throw
            contextManager.pruneOldEntries('nonexistent');
        });
    });

    describe('clearContext', () => {
        it('should clear a specific conversation', async () => {
            // Add entries to two different conversations
            await contextManager.addTranslationEntry('conversation1', {
                original: 'Hello1',
                translated: 'Hola1'
            });

            await contextManager.addTranslationEntry('conversation2', {
                original: 'Hello2',
                translated: 'Hola2'
            });

            // Clear only one conversation
            await contextManager.clearContext('conversation1');

            expect(contextManager.conversationContexts.has('conversation1')).to.be.false;
            expect(contextManager.conversationContexts.has('conversation2')).to.be.true;
        });

        it('should clear all conversations when no ID is provided', async () => {
            // Add entries to multiple conversations
            await contextManager.addTranslationEntry('conversation1', {
                original: 'Hello1',
                translated: 'Hola1'
            });

            await contextManager.addTranslationEntry('conversation2', {
                original: 'Hello2',
                translated: 'Hola2'
            });

            // Clear all conversations
            await contextManager.clearContext();

            expect(contextManager.conversationContexts.size).to.equal(0);
        });

        it('should handle non-existent conversation ID', async () => {
            // This should not throw
            await contextManager.clearContext('nonexistent');
        });
    });

    describe('edge cases', () => {
        it('should handle empty entries', async () => {
            const conversationId = 'conversation1';

            await contextManager.addTranslationEntry(conversationId, {
                original: '',
                translated: '',
                isSourceToTarget: true
            });

            const context = await contextManager.getConversationContext(conversationId);
            expect(context).to.include(' ->  '); // Empty but correctly formatted
        });

        it('should handle entries without timestamps', async () => {
            const conversationId = 'conversation1';

            await contextManager.addTranslationEntry(conversationId, {
                original: 'Hello',
                translated: 'Hola',
                isSourceToTarget: true
                // No timestamp provided
            });

            const context = contextManager.conversationContexts.get(conversationId);
            expect(context[0].timestamp).to.be.a('number');
        });

        it('should handle special characters in context', async () => {
            const conversationId = 'conversation1';

            await contextManager.addTranslationEntry(conversationId, {
                original: 'Special: !@#$%^&*()_+{}[]|\\:;"\'<>,.?/',
                translated: 'Especial: !@#$%^&*()_+{}[]|\\:;"\'<>,.?/',
                isSourceToTarget: true
            });

            const context = await contextManager.getConversationContext(conversationId);
            expect(context).to.include('Special: !@#$%^&*()_+{}[]|\\:;"\'<>,.?/ -> Especial: !@#$%^&*()_+{}[]|\\:;"\'<>,.?/');
        });
    });
});
