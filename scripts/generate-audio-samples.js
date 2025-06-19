/**
 * Audio Sample Generator for Testing
 * 
 * This script generates synthetic audio samples for testing STT and TTS functionality.
 * It uses the Web Audio API to generate simple sine wave tones as a placeholder.
 * 
 * In a real implementation, this would use a text-to-speech engine to generate
 * more realistic audio samples from test phrases.
 */

const fs = require('fs');
const path = require('path');
const { AudioContext, AudioBuffer } = require('web-audio-api');

// Configuration
const CONFIG = {
    sampleRate: 44100,
    duration: 2, // seconds
    outputDir: path.join(__dirname, '../fixtures/audio-samples'),
    languages: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
    phrases: {
        en: ['Hello world', 'How are you today', 'The weather is nice'],
        es: ['Hola mundo', 'Cómo estás hoy', 'El clima está bien'],
        fr: ['Bonjour le monde', 'Comment allez-vous aujourd\'hui', 'Le temps est beau'],
        de: ['Hallo Welt', 'Wie geht es dir heute', 'Das Wetter ist schön'],
        ja: ['こんにちは世界', 'お元気ですか', '天気がいいですね'],
        zh: ['你好世界', '你今天好吗', '天气很好']
    }
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

/**
 * Generate a simple sine wave audio buffer
 */
function generateSineWave(freq, duration, sampleRate) {
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = new AudioBuffer({
        numberOfChannels: 1,
        length: numSamples,
        sampleRate: sampleRate
    });

    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        data[i] = Math.sin(2 * Math.PI * freq * t);
    }

    return buffer;
}

/**
 * Save audio buffer as WAV file
 */
function saveAsWav(buffer, filePath) {
    // In a real implementation, this would convert AudioBuffer to WAV format
    // For now, we'll just create a placeholder file

    fs.writeFileSync(filePath, 'PLACEHOLDER AUDIO FILE');

    console.log(`Created mock audio file: ${filePath}`);
}

/**
 * Generate audio samples for all languages and phrases
 */
async function generateAllSamples() {
    // Create subdirectory for each language
    for (const lang of CONFIG.languages) {
        const langDir = path.join(CONFIG.outputDir, lang);
        if (!fs.existsSync(langDir)) {
            fs.mkdirSync(langDir);
        }

        // Generate audio for each phrase
        const phrases = CONFIG.phrases[lang] || [];
        for (let i = 0; i < phrases.length; i++) {
            const phrase = phrases[i];
            const filename = `${lang}_phrase_${i + 1}.wav`;
            const filePath = path.join(langDir, filename);

            // Generate different frequencies for different phrases
            const freq = 220 + (i * 110); // 220Hz, 330Hz, 440Hz

            // Create audio buffer
            const buffer = generateSineWave(freq, CONFIG.duration, CONFIG.sampleRate);

            // Save as WAV
            saveAsWav(buffer, filePath);

            // Create metadata file with transcript
            const metadataPath = path.join(langDir, `${lang}_phrase_${i + 1}.json`);
            fs.writeFileSync(metadataPath, JSON.stringify({
                language: lang,
                transcript: phrase,
                duration: CONFIG.duration,
                sampleRate: CONFIG.sampleRate
            }, null, 2));
        }
    }

    console.log('Generated all audio samples successfully!');
}

// Run the generator
generateAllSamples().catch(err => {
    console.error('Error generating audio samples:', err);
    process.exit(1);
});
