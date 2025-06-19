/**
 * Speech Synthesis Utilities - SSML generation and voice control
 * Handles SSML markup for advanced speech synthesis control
 */
const ssmlBuilder = require('ssml-builder');
const logger = require('../../../utils/logger');

class SpeechSynthesis {
    constructor() {
        this.ssmlSupport = {
            elevenlabs: true,
            azure: true,
            google: true
        };
    }

    /**
     * Converts text to SSML with voice control parameters
     * @param {string} text - The text to convert to SSML
     * @param {Object} options - Voice control options
     * @param {string} provider - The TTS provider (for provider-specific formatting)
     * @returns {string} SSML-formatted text
     */
    textToSSML(text, options = {}, provider = 'azure') {
        if (!this.ssmlSupport[provider]) {
            return text;
        }

        try {
            const speech = new ssmlBuilder(provider === 'google' ? 'google' : 'microsoft');

            // Start with base SSML document
            speech.startDocument();

            // Add voice tag if provided and supported
            if (options.voice && (provider === 'azure' || provider === 'google')) {
                speech.startVoice(options.voice);
            }

            // Add prosody controls
            const prosodyAttrs = {};

            if (options.rate !== undefined) {
                prosodyAttrs.rate = this.formatRate(options.rate, provider);
            }

            if (options.pitch !== undefined) {
                prosodyAttrs.pitch = this.formatPitch(options.pitch, provider);
            }

            if (options.volume !== undefined) {
                prosodyAttrs.volume = this.formatVolume(options.volume, provider);
            }

            if (Object.keys(prosodyAttrs).length > 0) {
                speech.startProsody(prosodyAttrs);
            }

            // Add emotional expression if supported and specified
            if (options.emotion && provider === 'azure') {
                speech.startElement('mstts:express-as', { style: options.emotion });
            }

            // Add the text, with proper handling of special characters
            speech.addText(this.escapeSSML(text));

            // Close all open tags in reverse order
            if (options.emotion && provider === 'azure') {
                speech.endElement(); // close express-as
            }

            if (Object.keys(prosodyAttrs).length > 0) {
                speech.endProsody();
            }

            if (options.voice && (provider === 'azure' || provider === 'google')) {
                speech.endVoice();
            }

            speech.endDocument();

            return speech.toString();
        } catch (error) {
            logger.error('Error generating SSML:', error);
            return text;
        }
    }

    /**
     * Format speech rate for different providers
     * @param {number} rate - Speech rate (0.5 - 2.0, 1.0 is normal)
     * @param {string} provider - The TTS provider
     * @returns {string} Formatted rate value
     */
    formatRate(rate, provider) {
        if (provider === 'azure') {
            // Azure uses percentages or descriptive terms
            if (rate <= 0.5) return 'x-slow';
            if (rate <= 0.75) return 'slow';
            if (rate >= 1.75) return 'x-fast';
            if (rate >= 1.25) return 'fast';
            return 'medium';
        } else if (provider === 'google') {
            // Google uses a multiplier
            return rate.toString();
        } else {
            // Default format
            return `${Math.round(rate * 100)}%`;
        }
    }

    /**
     * Format pitch for different providers
     * @param {number} pitch - Pitch adjustment (-10 to 10, 0 is normal)
     * @param {string} provider - The TTS provider
     * @returns {string} Formatted pitch value
     */
    formatPitch(pitch, provider) {
        if (provider === 'azure') {
            // Azure uses semitones in percentages or descriptive terms
            if (pitch <= -6) return 'x-low';
            if (pitch <= -2) return 'low';
            if (pitch >= 6) return 'x-high';
            if (pitch >= 2) return 'high';
            return 'medium';
        } else if (provider === 'google') {
            // Google uses semitones with +/- prefix
            return pitch > 0 ? `+${pitch}st` : `${pitch}st`;
        } else {
            // Default format - percentage from baseline
            const percent = 100 + (pitch * 10);
            return `${percent}%`;
        }
    }

    /**
     * Format volume for different providers
     * @param {number} volume - Volume level (0.0 - 1.0)
     * @param {string} provider - The TTS provider
     * @returns {string} Formatted volume value
     */
    formatVolume(volume, provider) {
        if (provider === 'azure') {
            // Azure uses percentages or descriptive terms
            if (volume <= 0.3) return 'x-soft';
            if (volume <= 0.6) return 'soft';
            if (volume >= 0.9) return 'loud';
            return 'medium';
        } else if (provider === 'google') {
            // Google uses dB values from -40 to 40
            const db = Math.round((volume * 2 - 1) * 40);
            return `${db}dB`;
        } else {
            // Default format - percentage
            return `${Math.round(volume * 100)}%`;
        }
    }

    /**
     * Escape special characters in text for SSML
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeSSML(text) {
        if (!text) return '';

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Add pauses to text for more natural speech
     * @param {string} text - Text to process
     * @param {string} provider - The TTS provider
     * @returns {string} Text with pause markers
     */
    addNaturalPauses(text, provider) {
        const ssml = new ssmlBuilder(provider === 'google' ? 'google' : 'microsoft');
        ssml.startDocument();

        // Split text by punctuation that typically indicates pauses
        const sentences = text.split(/([.!?]+)/).filter(Boolean);

        for (let i = 0; i < sentences.length; i++) {
            ssml.addText(this.escapeSSML(sentences[i]));

            // Add appropriate pause after punctuation
            if (i % 2 === 1) { // odd indexes contain punctuation
                const pauseLength = sentences[i].includes('!') || sentences[i].includes('?') ? '750ms' : '500ms';
                ssml.pauseByMilliseconds(parseInt(pauseLength));
            }
        }

        ssml.endDocument();
        return ssml.toString();
    }

    /**
     * Add emotional expression to text
     * @param {string} text - Text to process
     * @param {string} emotion - Emotion to express (excited, sad, etc)
     * @param {string} provider - The TTS provider
     * @returns {string} SSML with emotional expression
     */
    addEmotionalExpression(text, emotion, provider) {
        if (provider !== 'azure') {
            return this.textToSSML(text, { emotion }, provider);
        }

        const ssml = new ssmlBuilder('microsoft');
        ssml.startDocument();

        // Azure supports emotion through express-as tag
        ssml.startElement('mstts:express-as', { style: emotion });
        ssml.addText(this.escapeSSML(text));
        ssml.endElement();

        ssml.endDocument();
        return ssml.toString();
    }

    /**
     * Format text for pronunciation improvement
     * @param {string} text - Text to format
     * @param {string} languageCode - Language code
     * @returns {string} Text with pronunciation improvements
     */
    improvePronunciation(text, languageCode) {
        // This implementation will depend on language-specific rules
        // Basic example for demonstration
        if (languageCode === 'en') {
            // Common English pronunciation fixes
            return text
                .replace(/(\d+)([.])(\d+)/g, '$1 point $3') // Replace decimals with "point"
                .replace(/(\d{4})-(\d{2})-(\d{2})/g, '$1 $2 $3'); // Better date pronunciation
        }

        return text;
    }
}

module.exports = SpeechSynthesis;
