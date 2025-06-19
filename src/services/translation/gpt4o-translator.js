/**
 * GPT-4o Translator
 * Provides context-aware translation with cultural adaptation
 * capabilities using OpenAI's GPT-4o model.
 */

const { OpenAI } = require('openai');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class GPT4oTranslator extends EventEmitter {
    constructor(config = {}) {
        super();

        // Configuration
        this.config = {
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            model: config.model || 'gpt-4o',
            temperature: config.temperature || 0.1,
            maxTokens: config.maxTokens || 1000,
            timeout: config.timeout || 30000,
            contextWindowSize: config.contextWindowSize || 10,
            ...config
        };

        this.openai = null;
        this.isInitialized = false;
        this.supportedLanguages = [];
        this.conversationContexts = new Map();
        this.culturalProfiles = new Map();
        this.metrics = {
            requestCount: 0,
            totalTokensUsed: 0,
            averageLatency: 0,
            successRate: 1.0
        };
    }

    /**
     * Initialize GPT-4o translator
     * 
     * @returns {Promise<object>} Initialization result
     */
    async initialize() {
        try {
            // Initialize OpenAI client
            this.openai = new OpenAI({
                apiKey: this.config.apiKey,
                timeout: this.config.timeout
            });

            // Load cultural adaptation profiles
            this.loadCulturalProfiles();

            // Test connection
            await this.testConnection();

            this.isInitialized = true;

            return {
                success: true,
                model: this.config.model,
                culturalProfiles: Array.from(this.culturalProfiles.keys())
            };

        } catch (error) {
            console.error('GPT-4o initialization failed:', error);
            throw error;
        }
    }

    /**
     * Test GPT-4o connection
     * 
     * @returns {Promise<boolean>} Connection test result
     */
    async testConnection() {
        try {
            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: [{ role: "user", content: "Respond with the word 'connected' to test the connection." }],
                max_tokens: 20,
                temperature: 0
            });

            const success = response.choices[0].message.content.toLowerCase().includes('connected');

            if (!success) {
                throw new Error('Connection test response was unexpected');
            }

            return true;
        } catch (error) {
            throw new Error(`GPT-4o connection test failed: ${error.message}`);
        }
    }

    /**
     * Load cultural adaptation profiles
     */
    loadCulturalProfiles() {
        // Business communication profile
        this.culturalProfiles.set('business', {
            tone: 'professional',
            formality: 'formal',
            culturalNotes: 'Use business terminology, maintain professional tone, avoid colloquialisms.',
            prioritizeAccuracy: true
        });

        // Casual conversation profile
        this.culturalProfiles.set('casual', {
            tone: 'friendly',
            formality: 'informal',
            culturalNotes: 'Use conversational language, can include idioms and colloquialisms appropriate for target culture.',
            prioritizeAccuracy: false
        });

        // Technical documentation profile
        this.culturalProfiles.set('technical', {
            tone: 'precise',
            formality: 'neutral',
            culturalNotes: 'Maintain technical terminology, prioritize accuracy over natural flow.',
            prioritizeAccuracy: true
        });

        // Medical communication profile
        this.culturalProfiles.set('medical', {
            tone: 'clinical',
            formality: 'formal',
            culturalNotes: 'Use precise medical terminology, avoid ambiguity, maintain clinical tone.',
            prioritizeAccuracy: true
        });

        // Default profile
        this.culturalProfiles.set('default', {
            tone: 'balanced',
            formality: 'neutral',
            culturalNotes: 'Balance accuracy with natural flow in target language.',
            prioritizeAccuracy: true
        });
    }

    /**
     * Main translation function
     * 
     * @param {string} text - Text to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {Promise<object>} Translation result
     */
    async translate(text, fromLanguage, toLanguage, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('GPT-4o translator not initialized');
            }

            // Simple translation without context
            const startTime = Date.now();

            const { systemPrompt, userPrompt } = this.buildTranslationContext({
                text,
                fromLanguage,
                toLanguage,
                profile: options.profile || 'default',
                preserveFormatting: options.preserveFormatting !== false,
                context: options.context || '',
                conversationId: options.conversationId || null
            });

            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens
            });

            const processingTime = Date.now() - startTime;

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.totalTokensUsed += response.usage?.total_tokens || 0;
            this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (processingTime * 0.1);

            // Parse response
            const result = this.parseGPTResponse(response, fromLanguage, toLanguage);

            // Update conversation context if needed
            if (options.conversationId && result.translation) {
                this.updateConversationContext(
                    options.conversationId,
                    text,
                    result.translation,
                    fromLanguage,
                    toLanguage
                );
            }

            return {
                ...result,
                processingTime,
                service: 'gpt4o',
                fromLanguage,
                toLanguage
            };

        } catch (error) {
            console.error('GPT-4o translation failed:', error);

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 0; // 0% success for this request

            throw error;
        }
    }

    /**
     * Context-aware translation with conversation history
     * 
     * @param {string} text - Text to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {string} context - Additional context
     * @param {string} conversationId - Conversation ID
     * @returns {Promise<object>} Translation result
     */
    async translateWithContext(text, fromLanguage, toLanguage, context, conversationId = null) {
        return this.translate(text, fromLanguage, toLanguage, {
            context: context,
            conversationId: conversationId,
            profile: 'default'
        });
    }

    /**
     * Build comprehensive translation context
     * 
     * @param {object} params - Parameters for building context
     * @returns {object} System and user prompts
     */
    buildTranslationContext(params) {
        const {
            text,
            fromLanguage,
            toLanguage,
            profile = 'default',
            preserveFormatting = true,
            context = '',
            conversationId = null
        } = params;

        const culturalProfile = this.culturalProfiles.get(profile) || this.culturalProfiles.get('default');
        const conversationContext = conversationId ? this.getConversationContext(conversationId) : '';

        const systemPrompt = `You are a world-class professional translator and cultural adaptation specialist.

Your expertise includes:
- Accurate translation while preserving meaning and nuance
- Cultural adaptation for ${profile} communication
- Context-aware translation considering conversation history
- Maintaining appropriate formality and tone
- Adapting idiomatic expressions and cultural references

TRANSLATION REQUIREMENTS:
- Source Language: ${this.getLanguageName(fromLanguage)}
- Target Language: ${this.getLanguageName(toLanguage)}
- Communication Profile: ${profile} (${culturalProfile.tone}, ${culturalProfile.formality} formality)
- Preserve Formatting: ${preserveFormatting ? 'Yes' : 'No'}

${conversationContext ? `CONVERSATION CONTEXT:\n${conversationContext}\n` : ''}

${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ''}

CULTURAL ADAPTATION NOTES:
${culturalProfile.culturalNotes}

Return your response as valid JSON with this exact structure:
{
  "translation": "your accurate translation here",
  "confidence": 0.95,
  "reasoning": "brief explanation of translation choices",
  "alternatives": ["alternative 1", "alternative 2"],
  "formality": "formal|neutral|casual",
  "cultural_notes": "any cultural adaptations made"
}`;

        const userPrompt = `Translate this ${fromLanguage} text to ${toLanguage}:\n\n"${text}"`;

        return {
            systemPrompt,
            userPrompt
        };
    }

    /**
     * Parse GPT-4o response
     * 
     * @param {object} response - OpenAI API response
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @returns {object} Parsed translation result
     */
    parseGPTResponse(response, fromLanguage, toLanguage) {
        try {
            const content = response.choices[0].message.content;
            let result;

            try {
                // Try to parse as JSON
                result = JSON.parse(content);
            } catch (error) {
                // Fallback: Extract translation from plain text
                console.warn('Failed to parse GPT-4o response as JSON, using fallback extraction');
                return {
                    translation: content,
                    confidence: 0.7,
                    reasoning: "Extracted from plain text response",
                    alternatives: [],
                    formality: "neutral",
                    cultural_notes: ""
                };
            }

            return {
                translation: result.translation,
                confidence: result.confidence || 0.9,
                reasoning: result.reasoning || '',
                alternatives: result.alternatives || [],
                formality: result.formality || 'neutral',
                cultural_notes: result.cultural_notes || ''
            };

        } catch (error) {
            console.error('Error parsing GPT-4o response:', error);
            throw new Error(`Failed to parse translation response: ${error.message}`);
        }
    }

    /**
     * Get conversation context
     * 
     * @param {string} conversationId - Conversation ID
     * @returns {string} Formatted conversation context
     */
    getConversationContext(conversationId) {
        const context = this.conversationContexts.get(conversationId);
        if (!context || context.length === 0) {
            return '';
        }

        // Format the most recent N exchanges
        const recentContext = context.slice(-this.config.contextWindowSize);
        return recentContext.map(entry =>
            `[${entry.fromLanguage} → ${entry.toLanguage}] "${entry.original}" → "${entry.translated}"`
        ).join('\n');
    }

    /**
     * Update conversation context
     * 
     * @param {string} conversationId - Conversation ID
     * @param {string} original - Original text
     * @param {string} translated - Translated text
     * @param {string} fromLang - Source language code
     * @param {string} toLang - Target language code
     */
    updateConversationContext(conversationId, original, translated, fromLang, toLang) {
        if (!this.conversationContexts.has(conversationId)) {
            this.conversationContexts.set(conversationId, []);
        }

        const context = this.conversationContexts.get(conversationId);

        context.push({
            timestamp: Date.now(),
            original,
            translated,
            fromLanguage: fromLang,
            toLanguage: toLang
        });

        // Limit context size
        if (context.length > this.config.contextWindowSize * 2) {
            this.conversationContexts.set(
                conversationId,
                context.slice(-this.config.contextWindowSize)
            );
        }
    }

    /**
     * Batch translation with context preservation
     * 
     * @param {string[]} texts - Array of texts to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {Promise<object[]>} Array of translation results
     */
    async translateBatch(texts, fromLanguage, toLanguage, options = {}) {
        try {
            if (!this.isInitialized) {
                throw new Error('GPT-4o translator not initialized');
            }

            if (!Array.isArray(texts) || texts.length === 0) {
                throw new Error('Invalid texts array for batch translation');
            }

            // If only one text, use regular translation
            if (texts.length === 1) {
                return [await this.translate(texts[0], fromLanguage, toLanguage, options)];
            }

            const startTime = Date.now();

            // Build batch translation prompt
            const { systemPrompt, userPrompt } = this.buildBatchTranslationPrompt(
                texts,
                fromLanguage,
                toLanguage,
                options
            );

            const response = await this.openai.chat.completions.create({
                model: this.config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: this.config.temperature,
                max_tokens: Math.max(this.config.maxTokens, texts.length * 200) // Adjust token limit based on batch size
            });

            const processingTime = Date.now() - startTime;

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.totalTokensUsed += response.usage?.total_tokens || 0;
            this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (processingTime * 0.1);

            // Parse batch response
            const results = this.parseBatchResponse(
                response,
                texts,
                fromLanguage,
                toLanguage
            );

            // Update conversation context if needed
            if (options.conversationId) {
                results.forEach((result, i) => {
                    if (result.translation) {
                        this.updateConversationContext(
                            options.conversationId,
                            texts[i],
                            result.translation,
                            fromLanguage,
                            toLanguage
                        );
                    }
                });
            }

            return results.map(result => ({
                ...result,
                processingTime: processingTime / texts.length, // Distribute processing time
                service: 'gpt4o',
                fromLanguage,
                toLanguage
            }));

        } catch (error) {
            console.error('GPT-4o batch translation failed:', error);

            // Update metrics
            this.metrics.requestCount++;
            this.metrics.successRate = (this.metrics.successRate * 0.9) + 0; // 0% success

            // Fallback to individual translations
            console.log('Falling back to individual translations');

            const results = [];
            for (const text of texts) {
                try {
                    const result = await this.translate(text, fromLanguage, toLanguage, options);
                    results.push(result);
                } catch (err) {
                    results.push({
                        success: false,
                        translation: '',
                        error: err.message,
                        service: 'gpt4o',
                        fromLanguage,
                        toLanguage
                    });
                }
            }

            return results;
        }
    }

    /**
     * Build batch translation prompt
     * 
     * @param {string[]} texts - Array of texts to translate
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @param {object} options - Translation options
     * @returns {object} System and user prompts
     */
    buildBatchTranslationPrompt(texts, fromLanguage, toLanguage, options) {
        const { profile = 'default', context = '' } = options;

        const culturalProfile = this.culturalProfiles.get(profile) || this.culturalProfiles.get('default');
        const conversationContext = options.conversationId ? this.getConversationContext(options.conversationId) : '';

        const systemPrompt = `You are a professional translator specializing in batch translations from ${this.getLanguageName(fromLanguage)} to ${this.getLanguageName(toLanguage)}. 

Translate the following ${texts.length} texts, maintaining consistency in terminology and style.

Profile: ${profile} (${culturalProfile.tone}, ${culturalProfile.formality} formality)
${conversationContext ? `CONVERSATION CONTEXT:\n${conversationContext}\n` : ''}
${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ''}

Return as valid JSON with this exact structure:
{
  "translations": [
    {
      "translation": "translated text 1",
      "confidence": 0.95,
      "alternatives": ["alt 1", "alt 2"]
    },
    {
      "translation": "translated text 2",
      "confidence": 0.95,
      "alternatives": ["alt 1", "alt 2"]
    },
    ...
  ]
}`;

        const userPrompt = texts.map((text, i) => `${i + 1}. "${text}"`).join('\n');

        return { systemPrompt, userPrompt };
    }

    /**
     * Parse batch response
     * 
     * @param {object} response - OpenAI API response
     * @param {string[]} originalTexts - Original texts
     * @param {string} fromLanguage - Source language code
     * @param {string} toLanguage - Target language code
     * @returns {object[]} Array of translation results
     */
    parseBatchResponse(response, originalTexts, fromLanguage, toLanguage) {
        try {
            const content = response.choices[0].message.content;
            let parsed;

            try {
                // Try to parse as JSON
                parsed = JSON.parse(content);
            } catch (error) {
                console.warn('Failed to parse batch response as JSON:', error);

                // Fallback: return simple array of translations
                return originalTexts.map((_, index) => ({
                    translation: `Failed to parse batch translation ${index + 1}`,
                    confidence: 0.5,
                    alternatives: [],
                    formality: 'neutral',
                    success: false
                }));
            }

            // Ensure the expected structure exists
            if (!parsed.translations || !Array.isArray(parsed.translations)) {
                throw new Error('Invalid batch translation response format');
            }

            // Map the results, ensuring we have the right number of translations
            return originalTexts.map((originalText, index) => {
                if (index < parsed.translations.length) {
                    const trans = parsed.translations[index];
                    return {
                        success: true,
                        translation: trans.translation,
                        confidence: trans.confidence || 0.9,
                        alternatives: trans.alternatives || [],
                        formality: trans.formality || 'neutral',
                        original: originalText
                    };
                } else {
                    // Missing translation
                    return {
                        success: false,
                        translation: '',
                        confidence: 0,
                        alternatives: [],
                        formality: 'neutral',
                        original: originalText,
                        error: 'Missing translation in batch response'
                    };
                }
            });

        } catch (error) {
            console.error('Error parsing GPT-4o batch response:', error);
            throw new Error(`Failed to parse batch translation response: ${error.message}`);
        }
    }

    /**
     * Get language name for prompts
     * 
     * @param {string} code - Language code
     * @returns {string} Human-readable language name
     */
    getLanguageName(code) {
        const languageNames = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'da': 'Danish',
            'no': 'Norwegian',
            'fi': 'Finnish',
            'pl': 'Polish',
            'cs': 'Czech',
            'hu': 'Hungarian',
            'tr': 'Turkish',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'id': 'Indonesian',
            'uk': 'Ukrainian',
            'el': 'Greek'
        };

        return languageNames[code.toLowerCase()] || code.toUpperCase();
    }

    /**
     * Clear conversation context
     * 
     * @param {string} conversationId - Conversation ID to clear (all if null)
     */
    clearConversationContext(conversationId) {
        if (conversationId) {
            this.conversationContexts.delete(conversationId);
        } else {
            this.conversationContexts.clear();
        }
    }

    /**
     * Get supported languages (GPT-4o supports all languages)
     * 
     * @returns {string[]} Array of language codes
     */
    getSupportedLanguages() {
        // GPT-4o has broad language support
        return [
            'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh',
            'ar', 'tr', 'pl', 'uk', 'cs', 'sv', 'no', 'da', 'fi', 'el', 'hu',
            'ro', 'sk', 'sl', 'bg', 'lt', 'lv', 'et', 'hr', 'sr', 'id', 'ms',
            'vi', 'th', 'hi', 'bn', 'ta', 'te', 'ml', 'kn', 'mr', 'gu', 'pa',
            'ur', 'fa', 'he', 'ps', 'ha', 'yo', 'sw', 'zu', 'xh', 'af'
        ];
    }

    /**
     * Get service metrics
     * 
     * @returns {object} Service metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: Date.now()
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.isInitialized = false;
        this.conversationContexts.clear();
        this.removeAllListeners();
    }
}

module.exports = GPT4oTranslator;
