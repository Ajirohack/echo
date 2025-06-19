/**
 * Translation Flow Test
 * 
 * This test verifies the core translation functionality of the application.
 * It mocks the required services and tests the translation flow.
 */

// Mock the required modules
jest.mock('electron', () => ({
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
    invoke: jest.fn((channel, ...args) => {
      if (channel === 'translate-text') {
        return Promise.resolve({
          sourceText: args[0].text,
          translatedText: `[Translated to ${args[0].targetLanguage}] ${args[0].text}`,
          sourceLanguage: args[0].sourceLanguage,
          targetLanguage: args[0].targetLanguage,
          timestamp: new Date().toISOString(),
        });
      }
      return Promise.resolve({});
    }),
    removeListener: jest.fn(),
  },
}));

// Import the renderer after setting up mocks
const { translateText } = require('../src/renderer');

describe('Translation Flow', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up the DOM
    document.body.innerHTML = `
      <div id="app">
        <div id="sourceLanguage" value="en">English</div>
        <div id="targetLanguage" value="es">Spanish</div>
        <div id="sourceText" contenteditable="true"></div>
        <div id="translatedText"></div>
        <div id="statusMessage"></div>
      </div>
    `;
  });

  test('should translate text from English to Spanish', async () => {
    // Arrange
    const sourceText = 'Hello, how are you?';
    const sourceLanguage = 'en';
    const targetLanguage = 'es';
    
    // Act
    const result = await translateText({
      text: sourceText,
      sourceLanguage,
      targetLanguage,
    });
    
    // Assert
    expect(result).toBeDefined();
    expect(result.sourceText).toBe(sourceText);
    expect(result.translatedText).toContain('[Translated to es]');
    expect(result.sourceLanguage).toBe(sourceLanguage);
    expect(result.targetLanguage).toBe(targetLanguage);
    
    // Check if the translated text is displayed in the UI
    const translatedTextElement = document.getElementById('translatedText');
    expect(translatedTextElement.textContent).toContain('[Translated to es]');
  });

  test('should handle translation errors gracefully', async () => {
    // Mock a failed translation
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke.mockRejectedValueOnce(new Error('Translation service error'));
    
    // Arrange
    const sourceText = 'Hello, how are you?';
    const sourceLanguage = 'en';
    const targetLanguage = 'es';
    
    // Act & Assert
    await expect(translateText({
      text: sourceText,
      sourceLanguage,
      targetLanguage,
    })).rejects.toThrow('Translation service error');
    
    // Check if error status is displayed
    const statusMessage = document.getElementById('statusMessage');
    expect(statusMessage.textContent).toContain('error');
  });
});
