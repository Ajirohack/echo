/**
 * Integration tests for the Translation App
 * 
 * These tests verify the core functionality of the application including:
 * - Audio recording and processing
 * - Translation services
 * - Text-to-speech functionality
 * - UI interactions
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock Electron and other browser APIs
global.require = require;
global.console = console;

describe('Translation App Integration Tests', () => {
    let dom;
    let window;
    let document;
    
    // Mock Electron IPC
    const mockIpcRenderer = {
        on: jest.fn(),
        send: jest.fn(),
        invoke: jest.fn(),
        removeListener: jest.fn(),
        removeAllListeners: jest.fn(),
    };
    
    // Mock Web Audio API
    const mockAudioContext = {
        createAnalyser: jest.fn(),
        createMediaStreamDestination: jest.fn(),
        createMediaElementSource: jest.fn(),
        createMediaStreamSource: jest.fn(),
        suspend: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        resume: jest.fn().mockResolvedValue(undefined),
        state: 'suspended',
        destination: {},
    };
    
    // Mock WebRTC
    const mockMediaStream = {
        getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
        getAudioTracks: jest.fn().mockReturnValue([{ enabled: true, stop: jest.fn() }]),
    };
    
    // Mock the complete pipeline
    const mockCompletePipeline = {
        start: jest.fn().mockResolvedValue(true),
        stop: jest.fn().mockResolvedValue(true),
        setLanguages: jest.fn().mockResolvedValue(true),
        setVoice: jest.fn().mockResolvedValue(true),
        testVoice: jest.fn().mockResolvedValue(true),
    };

    beforeAll(() => {
        // Load the HTML file
        const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
        
        // Create a JSDOM instance
        dom = new JSDOM(html, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost:3000',
            beforeParse(window) {
                // Mock the window object
                global.window = window;
                global.document = window.document;
                
                // Mock Electron
                window.require = (module) => {
                    if (module === 'electron') {
                        return {
                            ipcRenderer: mockIpcRenderer,
                        };
                    }
                    return require(module);
                };
                
                // Mock Web Audio API
                window.AudioContext = jest.fn(() => mockAudioContext);
                
                // Mock WebRTC
                window.navigator.mediaDevices = {
                    getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
                    enumerateDevices: jest.fn().mockResolvedValue([
                        { kind: 'audioinput', deviceId: 'mic1', label: 'Microphone' },
                        { kind: 'audiooutput', deviceId: 'speaker1', label: 'Speakers' },
                    ]),
                };
                
                // Mock localStorage
                const localStorageMock = (() => {
                    let store = {};
                    return {
                        getItem: (key) => store[key] || null,
                        setItem: (key, value) => {
                            store[key] = value.toString();
                        },
                        clear: () => {
                            store = {};
                        },
                        removeItem: (key) => {
                            delete store[key];
                        },
                    };
                })();
                
                Object.defineProperty(window, 'localStorage', {
                    value: localStorageMock,
                    writable: true,
                });
            },
        });

        window = dom.window;
        document = window.document;
        
        // Load the renderer script
        const rendererPath = path.resolve(__dirname, '../renderer.js');
        const rendererScript = fs.readFileSync(rendererPath, 'utf8');
        
        // Evaluate the script in the JSDOM context
        const scriptElement = document.createElement('script');
        scriptElement.textContent = rendererScript;
        document.body.appendChild(scriptElement);
        
        // Mock the complete pipeline
        window.completePipeline = mockCompletePipeline;
    });

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        
        // Reset the DOM
        document.body.innerHTML = dom.window.document.body.innerHTML;
        
        // Re-initialize the app
        window.initApp();
    });

    afterAll(() => {
        // Clean up
        dom.window.close();
    });

    describe('Initialization', () => {
        test('should initialize the application', () => {
            expect(document.getElementById('statusMessage').textContent).toContain('Ready to start');
            expect(window.isRecording).toBe(false);
            expect(window.isTranslationActive).toBe(false);
        });
        
        test('should load settings from localStorage', () => {
            const testSettings = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                audioInputDevice: 'default',
                audioOutputDevice: 'default',
            };
            
            window.localStorage.setItem('translationAppSettings', JSON.stringify(testSettings));
            window.loadSettings();
            
            expect(document.getElementById('sourceLanguage').value).toBe(testSettings.sourceLanguage);
            expect(document.getElementById('targetLanguage').value).toBe(testSettings.targetLanguage);
        });
    });

    describe('Audio Recording', () => {
        test('should start and stop recording', async () => {
            // Mock the audio context
            const mockAudioContext = {
                suspend: jest.fn().mockResolvedValue(undefined),
                close: jest.fn().mockResolvedValue(undefined),
                resume: jest.fn().mockResolvedValue(undefined),
                createMediaStreamSource: jest.fn().mockReturnValue({
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                }),
                createAnalyser: jest.fn().mockReturnValue({
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                }),
                createMediaStreamDestination: jest.fn().mockReturnValue({
                    stream: { getTracks: () => [{ stop: jest.fn() }] },
                }),
                createScriptProcessor: jest.fn().mockReturnValue({
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                }),
                destination: {},
                state: 'suspended',
            };
            
            window.AudioContext = jest.fn(() => mockAudioContext);
            
            // Mock the media devices
            const mockStream = {
                getAudioTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
                getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
            };
            
            window.navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue(mockStream);
            
            // Start recording
            const recordButton = document.getElementById('recordButton');
            recordButton.click();
            
            // Wait for promises to resolve
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify recording started
            expect(window.isRecording).toBe(true);
            expect(document.getElementById('recordingIndicator').classList.contains('recording')).toBe(true);
            
            // Stop recording
            const stopButton = document.getElementById('stopButton');
            stopButton.click();
            
            // Wait for promises to resolve
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify recording stopped
            expect(window.isRecording).toBe(false);
            expect(document.getElementById('recordingIndicator').classList.contains('recording')).toBe(false);
        });
    });

    describe('Translation', () => {
        test('should translate text', async () => {
            // Mock the translation service
            const mockTranslation = {
                sourceText: 'Hello',
                translatedText: 'Hola',
                sourceLanguage: 'en',
                targetLanguage: 'es',
                timestamp: new Date().toISOString(),
            };
            
            // Mock the IPC response
            mockIpcRenderer.invoke.mockResolvedValue(mockTranslation);
            
            // Set the source text
            const sourceText = document.getElementById('sourceText');
            sourceText.value = 'Hello';
            
            // Click the translate button
            const translateButton = document.getElementById('translateButton');
            translateButton.click();
            
            // Wait for promises to resolve
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify the translation
            expect(document.getElementById('translatedText').textContent).toContain('Hola');
            expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('translate-text', {
                text: 'Hello',
                sourceLanguage: 'en',
                targetLanguage: 'es',
            });
        });
    });

    describe('Complete Pipeline', () => {
        test('should start and stop the complete pipeline', async () => {
            // Mock the complete pipeline
            mockCompletePipeline.start.mockResolvedValue(true);
            mockCompletePipeline.stop.mockResolvedValue(true);
            
            // Click the start pipeline button
            const startPipelineButton = document.getElementById('startPipelineButton');
            if (startPipelineButton) {
                startPipelineButton.click();
                
                // Wait for promises to resolve
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Verify pipeline started
                expect(mockCompletePipeline.start).toHaveBeenCalled();
                
                // Click the stop pipeline button
                const stopPipelineButton = document.getElementById('stopPipelineButton');
                if (stopPipelineButton) {
                    stopPipelineButton.click();
                    
                    // Wait for promises to resolve
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Verify pipeline stopped
                    expect(mockCompletePipeline.stop).toHaveBeenCalled();
                }
            }
        });
        
        test('should handle pipeline errors', async () => {
            // Mock an error
            const error = new Error('Pipeline error');
            mockCompletePipeline.start.mockRejectedValue(error);
            
            // Click the start pipeline button
            const startPipelineButton = document.getElementById('startPipelineButton');
            if (startPipelineButton) {
                startPipelineButton.click();
                
                // Wait for promises to resolve
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Verify error handling
                expect(document.getElementById('statusMessage').textContent).toContain('error');
            }
        });
    });

    describe('UI Interactions', () => {
        test('should swap languages', () => {
            // Set initial languages
            const sourceLanguage = document.getElementById('sourceLanguage');
            const targetLanguage = document.getElementById('targetLanguage');
            
            sourceLanguage.value = 'en';
            targetLanguage.value = 'es';
            
            // Click the swap button
            const swapButton = document.getElementById('swapLanguages');
            swapButton.click();
            
            // Verify languages were swapped
            expect(sourceLanguage.value).toBe('es');
            expect(targetLanguage.value).toBe('en');
        });
        
        test('should open and close settings modal', () => {
            // Click the settings button
            const settingsButton = document.getElementById('settingsButton');
            settingsButton.click();
            
            // Verify modal is open
            const settingsModal = document.getElementById('settingsModal');
            expect(settingsModal.style.display).toBe('block');
            
            // Click the close button
            const closeButton = settingsModal.querySelector('.close-modal');
            closeButton.click();
            
            // Verify modal is closed
            expect(settingsModal.style.display).toBe('none');
        });
    });
});
