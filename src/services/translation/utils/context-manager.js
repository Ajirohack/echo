/**
 * Context Manager
 * Manages conversation context for context-aware translation,
 * tracks conversation history, and provides contextual information
 * for translation services that support it.
 */

const uuid = require('uuid');
const moment = require('moment');

class ContextManager {
  constructor(config = {}) {
    this.conversationContexts = new Map();
    this.activeConversationId = null;
    this.config = {
      maxContextEntries: config.maxContextEntries || 10,
      maxContextAgeMs: config.maxContextAgeMs || 30 * 60 * 1000, // 30 minutes
      contextHistorySize: config.contextHistorySize || 10,
      contextExpirationTimeMs: config.contextExpirationTimeMs || 30 * 60 * 1000,
    };
    this.maxHistorySize = this.config.contextHistorySize;
    this.expirationTime = this.config.contextExpirationTimeMs;
    this.cleanupInterval = null;

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create a new conversation context
   *
   * @param {string} sourceLanguage - Source language code
   * @param {string} targetLanguage - Target language code
   * @param {object} options - Additional options
   * @returns {string} - Conversation ID
   */
  createConversation(sourceLanguage, targetLanguage, options = {}) {
    const conversationId = uuid.v4();
    const { name = 'Untitled Conversation', domain = 'general' } = options;

    this.conversationContexts.set(conversationId, {
      id: conversationId,
      name,
      sourceLanguage,
      targetLanguage,
      domain,
      history: [],
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      metadata: { ...options },
    });

    this.activeConversationId = conversationId;
    console.log(`Created conversation ${conversationId} (${sourceLanguage} → ${targetLanguage})`);

    return conversationId;
  }

  /**
   * Add a translation entry to the conversation history
   *
   * @param {string} conversationId - Conversation ID
   * @param {object} translationEntry - Translation entry details
   * @returns {boolean} - Success status
   */
  async addTranslationEntry(conversationId, translationEntry) {
    if (!conversationId) {
      return false;
    }

    // Create conversation context if it doesn't exist
    if (!this.conversationContexts.has(conversationId)) {
      this.conversationContexts.set(conversationId, []);
    }

    const context = this.conversationContexts.get(conversationId);

    // Add timestamp if not provided
    if (!translationEntry.timestamp) {
      translationEntry.timestamp = Date.now();
    }

    // Add entry to context
    context.push(translationEntry);

    // Limit context size
    if (context.length > this.config.maxContextEntries) {
      context.shift();
    }

    return true;
  }

  /**
   * Add a translation entry to the active conversation
   *
   * @param {object} translationEntry - Translation entry details
   * @returns {boolean} - Success status
   */
  addToActiveConversation(translationEntry) {
    if (!this.activeConversationId) {
      console.error('No active conversation');
      return false;
    }

    return this.addTranslationEntry(this.activeConversationId, translationEntry);
  }

  /**
   * Get conversation context for translation
   *
   * @param {string} conversationId - Conversation ID (uses active if not provided)
   * @param {number} contextSize - Number of history items to include
   * @returns {string} - Formatted context string
   */
  async getConversationContext(conversationId = null, contextSize = null) {
    const targetId = conversationId || this.activeConversationId;

    if (!targetId) {
      return '';
    }

    const context = this.conversationContexts.get(targetId);

    if (!context || context.length === 0) {
      return '';
    }

    const maxEntries = contextSize || this.config.maxContextEntries;
    const relevantContext = context.slice(-maxEntries);

    if (relevantContext.length === 0) {
      return '';
    }

    // Format the context string
    let contextString = '';

    relevantContext.forEach((entry) => {
      const direction = entry.isSourceToTarget ? ' -> ' : ' <- ';
      contextString += `${entry.original || ''}${direction}${entry.translated || ' '}\n`;
    });

    return contextString;
  }

  /**
   * Get active conversation details
   *
   * @returns {object|null} - Active conversation details
   */
  getActiveConversation() {
    if (!this.activeConversationId) {
      return null;
    }

    return this.conversations.get(this.activeConversationId);
  }

  /**
   * Switch active conversation
   *
   * @param {string} conversationId - Conversation ID to activate
   * @returns {boolean} - Success status
   */
  setActiveConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      console.error(`Conversation ${conversationId} not found`);
      return false;
    }

    this.activeConversationId = conversationId;
    return true;
  }

  /**
   * Get domain for the current conversation
   *
   * @param {string} conversationId - Conversation ID (uses active if not provided)
   * @returns {string} - Domain name
   */
  getConversationDomain(conversationId = null) {
    const targetId = conversationId || this.activeConversationId;

    if (!targetId) {
      return 'general';
    }

    const conversation = this.conversations.get(targetId);

    if (!conversation) {
      return 'general';
    }

    return conversation.domain;
  }

  /**
   * Get recent terms used in the conversation for consistency
   *
   * @param {string} conversationId - Conversation ID (uses active if not provided)
   * @param {number} maxTerms - Maximum number of terms to extract
   * @returns {object} - Dictionary of terms and their translations
   */
  getRecentTerms(conversationId = null, maxTerms = 10) {
    const targetId = conversationId || this.activeConversationId;

    if (!targetId) {
      return {};
    }

    const conversation = this.conversations.get(targetId);

    if (!conversation || conversation.history.length === 0) {
      return {};
    }

    // Extract recent terms from history (implementation depends on how you want to identify terms)
    const terms = {};

    // Simple implementation: extract terms based on capitalized words and phrases
    conversation.history.forEach((entry) => {
      const originalWords = entry.originalText.split(/\s+/);
      const translatedWords = entry.translatedText.split(/\s+/);

      // Match terms that are capitalized and appear in both texts
      originalWords.forEach((word, index) => {
        if (
          word.length > 1 &&
          word[0] === word[0].toUpperCase() &&
          word[0] !== word[0].toLowerCase()
        ) {
          // This is a capitalized word, potentially a term
          if (index < translatedWords.length) {
            terms[word] = translatedWords[index];
          }
        }
      });
    });

    // Return the most recent terms up to maxTerms
    const termKeys = Object.keys(terms);
    if (termKeys.length <= maxTerms) {
      return terms;
    }

    const result = {};
    termKeys.slice(-maxTerms).forEach((key) => {
      result[key] = terms[key];
    });

    return result;
  }

  /**
   * Save conversation history to file
   *
   * @param {string} conversationId - Conversation ID to export
   * @returns {object} - Conversation data
   */
  exportConversation(conversationId = null) {
    const targetId = conversationId || this.activeConversationId;

    if (!targetId) {
      throw new Error('No conversation ID provided and no active conversation');
    }

    const conversation = this.conversations.get(targetId);

    if (!conversation) {
      throw new Error(`Conversation ${targetId} not found`);
    }

    return {
      ...conversation,
      exportedAt: Date.now(),
    };
  }

  /**
   * Delete a conversation
   *
   * @param {string} conversationId - Conversation ID to delete
   * @returns {boolean} - Success status
   */
  deleteConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      return false;
    }

    this.conversations.delete(conversationId);

    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }

    return true;
  }

  /**
   * Start cleanup interval for expired conversations
   */
  startCleanupInterval() {
    // Clean up every 15 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredConversations();
      },
      15 * 60 * 1000
    );
  }

  /**
   * Clean up expired conversations
   */
  cleanupExpiredConversations() {
    const now = Date.now();

    this.conversationContexts.forEach((context, id) => {
      if (context.length > 0) {
        const lastEntry = context[context.length - 1];
        if (now - lastEntry.timestamp > this.config.maxContextAgeMs) {
          console.log(`Cleaning up expired conversation ${id}`);
          this.conversationContexts.delete(id);
        }
      }
    });
  }

  /**
   * Prune old entries from a conversation
   */
  pruneOldEntries(conversationId) {
    const context = this.conversationContexts.get(conversationId);
    if (!context) {
      return;
    }

    const now = Date.now();
    const filteredContext = context.filter(
      (entry) => now - entry.timestamp <= this.config.maxContextAgeMs
    );

    this.conversationContexts.set(conversationId, filteredContext);
  }

  /**
   * Clear context for a specific conversation or all conversations
   */
  clearContext(conversationId = null) {
    if (conversationId) {
      this.conversationContexts.delete(conversationId);
    } else {
      this.conversationContexts.clear();
    }
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up resources when destroying
   */
  destroy() {
    this.stopCleanupInterval();
    this.conversationContexts.clear();
    this.activeConversationId = null;
  }
}

module.exports = ContextManager;
