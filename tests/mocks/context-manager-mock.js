/**
 * Mock Context Manager for testing
 */

class MockContextManager {
    constructor() {
        this.isInitialized = false;
        this.conversationContexts = new Map();
        this.config = {
            maxContextEntries: 10,
            maxContextAgeMs: 30 * 60 * 1000 // 30 minutes
        };
    }

    /**
     * Initialize context manager
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Add a translation entry to conversation context
     * 
     * @param {string} conversationId - Conversation ID
     * @param {object} entry - Translation entry
     * @returns {Promise<void>}
     */
    async addTranslationEntry(conversationId, entry) {
        if (!conversationId) return;

        if (!this.conversationContexts.has(conversationId)) {
            this.conversationContexts.set(conversationId, []);
        }

        const context = this.conversationContexts.get(conversationId);

        // Add new entry
        context.push({
            ...entry,
            timestamp: entry.timestamp || Date.now()
        });

        // Prune old entries
        this.pruneOldEntries(conversationId);
    }

    /**
     * Get conversation context
     * 
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<string>} Formatted context
     */
    async getConversationContext(conversationId) {
        if (!conversationId || !this.conversationContexts.has(conversationId)) {
            return '';
        }

        // Prune old entries first
        this.pruneOldEntries(conversationId);

        const context = this.conversationContexts.get(conversationId);
        if (!context || context.length === 0) {
            return '';
        }

        // Format context for translator
        return context.map(entry => {
            const direction = entry.isSourceToTarget ? '->' : '<-';
            return `[${new Date(entry.timestamp).toISOString()}] ${entry.original} ${direction} ${entry.translated}`;
        }).join('\n');
    }

    /**
     * Prune old entries from conversation context
     * 
     * @param {string} conversationId - Conversation ID
     */
    pruneOldEntries(conversationId) {
        if (!conversationId || !this.conversationContexts.has(conversationId)) {
            return;
        }

        const context = this.conversationContexts.get(conversationId);

        // Remove entries older than maxContextAgeMs
        const now = Date.now();
        const filtered = context.filter(entry => {
            return (now - entry.timestamp) < this.config.maxContextAgeMs;
        });

        // Limit to max entries
        const limited = filtered.slice(-this.config.maxContextEntries);

        this.conversationContexts.set(conversationId, limited);
    }

    /**
     * Clear conversation context
     * 
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<void>}
     */
    async clearContext(conversationId) {
        if (conversationId) {
            this.conversationContexts.delete(conversationId);
        } else {
            this.conversationContexts.clear();
        }

        return Promise.resolve();
    }
}

module.exports = MockContextManager;
