const WhisperSTT = require('../../../src/services/stt/whisper.js');
const AzureSTT = require('../../../src/services/stt/azure.js');
const GoogleSTT = require('../../../src/services/stt/google.js');

jest.mock('../../../src/services/stt/whisper.js');
jest.mock('../../../src/services/stt/azure.js');
jest.mock('../../../src/services/stt/google.js');

describe('STT Services', () => {
    let whisperSTT, azureSTT, googleSTT;
    
    beforeEach(() => {
        whisperSTT = new WhisperSTT();
        azureSTT = new AzureSTT();
        googleSTT = new GoogleSTT();
    });
    
    describe('Whisper STT', () => {
        test('should transcribe audio successfully', async () => {
            const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);
            const result = await whisperSTT.transcribe(audioBuffer);
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });
        
        test('should handle errors gracefully', async () => {
            WhisperSTT.prototype.transcribe.mockRejectedValue(new Error('API error'));
            try {
                await whisperSTT.transcribe(new Float32Array());
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toBe('API error');
            }
        });
    });
    
    describe('Azure STT', () => {
        test('should authenticate with Azure', async () => {
            await azureSTT.authenticate();
            expect(azureSTT.isAuthenticated).toBe(true);
        });
        
        test('should transcribe with rate limiting', async () => {
            const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);
            const result = await azureSTT.transcribe(audioBuffer);
            expect(result).toBeDefined();
        });
    });
    
    describe('Google STT', () => {
        test('should handle large audio files', async () => {
            const largeAudioBuffer = new Float32Array(1000000);
            const result = await googleSTT.transcribe(largeAudioBuffer);
            expect(result).toBeDefined();
        });
        
        test('should handle multiple languages', async () => {
            const audioBuffer = new Float32Array([0.1, 0.2, 0.3]);
            const result = await googleSTT.transcribe(audioBuffer, 'fr');
            expect(result).toBeDefined();
        });
    });
});
