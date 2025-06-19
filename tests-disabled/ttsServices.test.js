const ElevenLabsTTS = require('../../../src/services/tts/elevenlabs.js');
const AzureTTS = require('../../../src/services/tts/azure.js');
const GoogleTTS = require('../../../src/services/tts/google.js');

jest.mock('../../../src/services/tts/elevenlabs.js');
jest.mock('../../../src/services/tts/azure.js');
jest.mock('../../../src/services/tts/google.js');

describe('TTS Services', () => {
    let elevenlabs, azure, google;
    
    beforeEach(() => {
        elevenlabs = new ElevenLabsTTS();
        azure = new AzureTTS();
        google = new GoogleTTS();
    });
    
    describe('ElevenLabs TTS', () => {
        test('should synthesize speech successfully', async () => {
            const result = await elevenlabs.synthesize('Hello', 'en');
            expect(result).toBeDefined();
            expect(result instanceof ArrayBuffer).toBe(true);
        });
        
        test('should handle different voices', async () => {
            const voices = await elevenlabs.getVoices();
            expect(voices.length).toBeGreaterThan(0);
            
            const result = await elevenlabs.synthesize('Hello', 'en', voices[0].id);
            expect(result).toBeDefined();
        });
    });
    
    describe('Azure TTS', () => {
        test('should synthesize with SSML', async () => {
            const ssml = '<speak>Hello</speak>';
            const result = await azure.synthesize(ssml, 'en');
            expect(result).toBeDefined();
        });
        
        test('should handle different languages', async () => {
            const result = await azure.synthesize('Bonjour', 'fr');
            expect(result).toBeDefined();
        });
    });
    
    describe('Google TTS', () => {
        test('should synthesize with different speeds', async () => {
            const result = await google.synthesize('Hello', 'en', { speed: 1.5 });
            expect(result).toBeDefined();
        });
        
        test('should handle punctuation', async () => {
            const text = 'Hello. How are you?';
            const result = await google.synthesize(text, 'en');
            expect(result).toBeDefined();
        });
    });
    
    describe('Performance', () => {
        test('should synthesize within latency threshold', async () => {
            const startTime = Date.now();
            await elevenlabs.synthesize('Hello', 'en');
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(1500); // 1.5 seconds
        });
    });
});
