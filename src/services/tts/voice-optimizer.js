/**
 * Voice Optimizer - Optimizes voice selection and quality
 * Selects the best voice for each language and optimizes voice parameters
 */
const EventEmitter = require('events');
const VoiceMapper = require('./utils/voice-mapper');
const AudioProcessor = require('./utils/audio-processor');
const logger = require('../../utils/logger');

class VoiceOptimizer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            preferredProvider: 'elevenlabs',
            defaultGender: 'auto',
            defaultStyle: 'neutral',
            defaultRate: 1.0,
            defaultPitch: 0,
            defaultVolume: 1.0,
            emotionalMapping: true,
            ...config
        };

        this.voiceMapper = new VoiceMapper();
        this.audioProcessor = new AudioProcessor();
        this.serviceProviders = [];
        this.languageVoiceCache = new Map();
    }

    /**
     * Register TTS service providers
     * @param {Array} providers - Array of TTS service provider instances
     */
    registerProviders(providers) {
        this.serviceProviders = providers;

        // Register event listeners for each provider
        for (const provider of this.serviceProviders) {
            provider.on('synthesisComplete', (data) => {
                this.emit('synthesisComplete', data);
            });
        }

        logger.info(`Registered ${providers.length} TTS providers with Voice Optimizer`);
    }

    /**
     * Get the optimal voice for a language
     * @param {string} languageCode - The ISO language code
     * @param {Object} options - Voice selection options
     * @returns {Promise<Object>} The selected voice with provider details
     */
    async getOptimalVoice(languageCode, options = {}) {
        const opts = {
            provider: options.provider || this.config.preferredProvider,
            gender: options.gender || this.config.defaultGender,
            style: options.style || this.config.defaultStyle,
            ...options
        };

        // Check cache first
        const cacheKey = `${languageCode}:${opts.provider}:${opts.gender}:${opts.style}`;
        if (this.languageVoiceCache.has(cacheKey)) {
            return this.languageVoiceCache.get(cacheKey);
        }

        // Get voice from mapper
        const mappedVoice = this.voiceMapper.getVoiceForLanguage(
            languageCode,
            opts.provider,
            opts.gender,
            opts.style
        );

        // Store provider reference
        const provider = this.getProviderByName(mappedVoice.provider);

        const voiceInfo = {
            id: mappedVoice.id,
            name: mappedVoice.name,
            provider: mappedVoice.provider,
            gender: mappedVoice.gender,
            language: mappedVoice.language,
            style: mappedVoice.style,
            quality: mappedVoice.quality,
            providerInstance: provider
        };

        // Cache the result
        this.languageVoiceCache.set(cacheKey, voiceInfo);

        return voiceInfo;
    }

    /**
     * Get provider instance by name
     * @param {string} providerName - Provider name
     * @returns {Object} Provider instance
     */
    getProviderByName(providerName) {
        const normalizedName = providerName.toLowerCase();

        if (normalizedName === 'elevenlabs') {
            return this.serviceProviders.find(p => p.constructor.name === 'ElevenLabsService');
        } else if (normalizedName === 'azure') {
            return this.serviceProviders.find(p => p.constructor.name === 'AzureTTS');
        } else if (normalizedName === 'google') {
            return this.serviceProviders.find(p => p.constructor.name === 'GoogleTTS');
        }

        return this.serviceProviders[0];
    }

    /**
     * Optimize voice parameters based on text content
     * @param {string} text - Text to analyze
     * @param {Object} baseParams - Base voice parameters
     * @returns {Object} Optimized voice parameters
     */
    optimizeVoiceParams(text, baseParams = {}) {
        const params = {
            rate: baseParams.rate || this.config.defaultRate,
            pitch: baseParams.pitch || this.config.defaultPitch,
            volume: baseParams.volume || this.config.defaultVolume,
            emotion: baseParams.emotion || 'neutral',
            ...baseParams
        };

        // Only apply emotional mapping if enabled
        if (!this.config.emotionalMapping) {
            return params;
        }

        // Simple text analysis for emotion detection
        const textLower = text.toLowerCase();

        // Detect questions
        if (text.includes('?')) {
            params.pitch += 0.5; // Slightly raise pitch for questions
            params.rate *= 0.95; // Slightly slow down for questions
        }

        // Detect exclamations
        if (text.includes('!')) {
            params.volume *= 1.1; // Slightly increase volume for exclamations
            params.rate *= 1.05; // Slightly speed up for exclamations
        }

        // Detect emotional content
        const emotionalPatterns = {
            excited: ['wow', 'amazing', 'fantastic', 'great', 'excellent', 'awesome'],
            happy: ['happy', 'glad', 'pleased', 'joy', 'delighted'],
            sad: ['sad', 'sorry', 'unfortunately', 'regret', 'disappointed'],
            angry: ['angry', 'upset', 'frustrating', 'terrible', 'awful'],
            calm: ['calm', 'relaxed', 'peaceful', 'gentle', 'easy']
        };

        // Check for emotion matches
        for (const [emotion, patterns] of Object.entries(emotionalPatterns)) {
            for (const pattern of patterns) {
                if (textLower.includes(pattern)) {
                    params.emotion = emotion;

                    // Adjust parameters based on detected emotion
                    if (emotion === 'excited' || emotion === 'happy') {
                        params.rate *= 1.1;
                        params.pitch += 1;
                        params.volume *= 1.05;
                    } else if (emotion === 'sad') {
                        params.rate *= 0.9;
                        params.pitch -= 1;
                        params.volume *= 0.95;
                    } else if (emotion === 'angry') {
                        params.rate *= 1.05;
                        params.pitch -= 0.5;
                        params.volume *= 1.1;
                    } else if (emotion === 'calm') {
                        params.rate *= 0.95;
                        params.pitch -= 0.5;
                        params.volume *= 0.9;
                    }

                    break;
                }
            }
        }

        // Clamp values to reasonable ranges
        params.rate = Math.max(0.5, Math.min(2.0, params.rate));
        params.pitch = Math.max(-10, Math.min(10, params.pitch));
        params.volume = Math.max(0.5, Math.min(1.5, params.volume));

        return params;
    }

    /**
     * Optimize audio quality for specific use cases
     * @param {Buffer} audioData - The audio data to optimize
     * @param {string} format - Audio format
     * @param {string} useCase - Optimization use case
     * @returns {Promise<Buffer>} Optimized audio data
     */
    async optimizeAudioQuality(audioData, format = 'mp3', useCase = 'communication') {
        let processingOptions = {};

        switch (useCase) {
            case 'communication':
                // Optimize for communication apps (Zoom, Teams, etc)
                processingOptions = {
                    normalization: true,
                    sampleRate: 24000,
                    channels: 1,
                    format: 'mp3'
                };
                break;

            case 'clarity':
                // Optimize for maximum clarity
                processingOptions = {
                    normalization: true,
                    sampleRate: 44100,
                    channels: 1,
                    format: 'mp3'
                };
                break;

            case 'size':
                // Optimize for smaller file size
                processingOptions = {
                    normalization: true,
                    sampleRate: 16000,
                    channels: 1,
                    format: 'mp3'
                };
                break;

            default:
                processingOptions = {
                    normalization: true
                };
        }

        return this.audioProcessor.processAudio(audioData, format, processingOptions);
    }

    /**
     * Get available voices for a language across all providers
     * @param {string} languageCode - The ISO language code
     * @returns {Promise<Object>} Object with voices grouped by provider
     */
    async getAvailableVoices(languageCode) {
        return this.voiceMapper.getAllVoicesForLanguage(languageCode);
    }

    /**
     * Get supported languages across all providers
     * @returns {Array} Array of supported language codes
     */
    getSupportedLanguages() {
        return this.voiceMapper.getSupportedLanguages();
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };

        // Clear cache when config changes
        this.languageVoiceCache.clear();
    }
}

module.exports = VoiceOptimizer;
