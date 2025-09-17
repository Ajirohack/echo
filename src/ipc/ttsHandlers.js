/**
 * TTS IPC Handlers
 * Exposes TTS Manager functionality to renderer processes
 */

const { ipcMain } = require('electron');
const TTSManager = require('../services/tts/tts-manager');
const logger = require('../utils/logger');

// Initialize TTS Manager
let ttsManager = null;

/**
 * Initialize TTS Manager
 */
async function initializeTTSManager() {
  if (!ttsManager) {
    try {
      ttsManager = new TTSManager();
      await ttsManager.initialize();
      logger.info('TTS Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TTS Manager:', error);
      throw error;
    }
  }
  return ttsManager;
}

/**
 * Get available voices for a language
 */
ipcMain.handle('tts:getVoices', async (event, language) => {
  try {
    await initializeTTSManager();
    const voices = await ttsManager.getVoices(language);
    return { success: true, data: voices };
  } catch (error) {
    logger.error('Failed to get TTS voices:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Synthesize speech from text
 */
ipcMain.handle('tts:synthesize', async (event, text, language, options = {}) => {
  try {
    await initializeTTSManager();

    if (!text || text.trim() === '') {
      throw new Error('Text is required for synthesis');
    }

    const result = await ttsManager.synthesize(text, {
      language: language,
      voice: options.voice,
      speed: options.speed,
      pitch: options.pitch,
      volume: options.volume,
    });

    return { success: true, audioData: result.audioData, metadata: result.metadata };
  } catch (error) {
    logger.error('Failed to synthesize speech:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Play audio data through specified output device
 */
ipcMain.handle('tts:play', async (event, audioData, outputDevice = 'default') => {
  try {
    await initializeTTSManager();

    if (!audioData) {
      throw new Error('Audio data is required for playback');
    }

    await ttsManager.routeAudio(audioData, {
      outputDevice: outputDevice,
      format: 'mp3',
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to play TTS audio:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Speak text directly (synthesize and play in one step)
 */
ipcMain.handle('tts:speak', async (event, text, language, options = {}) => {
  try {
    await initializeTTSManager();

    if (!text || text.trim() === '') {
      throw new Error('Text is required for speech');
    }

    const result = await ttsManager.speakText(text, {
      language: language,
      voice: options.voice,
      speed: options.speed,
      pitch: options.pitch,
      volume: options.volume,
      outputDevice: options.outputDevice || 'default',
    });

    return { success: true, metadata: result.metadata };
  } catch (error) {
    logger.error('Failed to speak text:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Stop current TTS playback
 */
ipcMain.handle('tts:stop', async (event) => {
  try {
    await initializeTTSManager();
    await ttsManager.stopPlayback();
    return { success: true };
  } catch (error) {
    logger.error('Failed to stop TTS playback:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get TTS configuration
 */
ipcMain.handle('tts:getConfig', async (event) => {
  try {
    await initializeTTSManager();
    const config = ttsManager.getConfig();
    return { success: true, data: config };
  } catch (error) {
    logger.error('Failed to get TTS config:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Update TTS configuration
 */
ipcMain.handle('tts:updateConfig', async (event, config) => {
  try {
    await initializeTTSManager();
    await ttsManager.updateConfig(config);
    return { success: true };
  } catch (error) {
    logger.error('Failed to update TTS config:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Get active voice for a language
 */
ipcMain.handle('tts:getActiveVoice', async (event, language) => {
  try {
    await initializeTTSManager();
    const voice = ttsManager.getActiveVoice(language);
    return { success: true, data: voice };
  } catch (error) {
    logger.error('Failed to get active voice:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Set default voice for a language
 */
ipcMain.handle('tts:setDefaultVoice', async (event, language, voiceId, provider) => {
  try {
    await initializeTTSManager();
    ttsManager.setDefaultVoice(language, voiceId, provider);
    return { success: true };
  } catch (error) {
    logger.error('Failed to set default voice:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Initialize TTS handlers
 */
function initializeTTSHandlers() {
  logger.info('TTS handlers initialized successfully');
}

/**
 * Cleanup TTS handlers
 */
function cleanupTTSHandlers() {
  try {
    // Remove all TTS-related IPC handlers
    const handlers = [
      'tts:initialize',
      'tts:getVoices',
      'tts:synthesize',
      'tts:play',
      'tts:speak',
      'tts:stop',
      'tts:getConfig',
      'tts:updateConfig',
      'tts:getActiveVoice',
      'tts:setDefaultVoice',
    ];

    handlers.forEach((handler) => {
      if (ipcMain.removeHandler) {
        ipcMain.removeHandler(handler);
      }
    });

    // Clean up TTS manager
    if (ttsManager) {
      ttsManager = null;
    }

    logger.info('TTS handlers cleaned up successfully');
  } catch (error) {
    logger.error('Error cleaning up TTS handlers:', error);
  }
}

// Event listeners for TTS events
if (ttsManager) {
  ttsManager.on('voiceChanged', (voice) => {
    // Broadcast voice change to all renderer processes
    const webContents = require('electron').webContents.getAllWebContents();
    webContents.forEach((wc) => {
      if (!wc.isDestroyed()) {
        wc.send('tts:voiceChanged', voice);
      }
    });
  });

  ttsManager.on('synthesisStarted', (data) => {
    const webContents = require('electron').webContents.getAllWebContents();
    webContents.forEach((wc) => {
      if (!wc.isDestroyed()) {
        wc.send('tts:synthesisStarted', data);
      }
    });
  });

  ttsManager.on('synthesisCompleted', (data) => {
    const webContents = require('electron').webContents.getAllWebContents();
    webContents.forEach((wc) => {
      if (!wc.isDestroyed()) {
        wc.send('tts:synthesisCompleted', data);
      }
    });
  });

  ttsManager.on('playbackStarted', (data) => {
    const webContents = require('electron').webContents.getAllWebContents();
    webContents.forEach((wc) => {
      if (!wc.isDestroyed()) {
        wc.send('tts:playbackStarted', data);
      }
    });
  });

  ttsManager.on('playbackCompleted', (data) => {
    const webContents = require('electron').webContents.getAllWebContents();
    webContents.forEach((wc) => {
      if (!wc.isDestroyed()) {
        wc.send('tts:playbackCompleted', data);
      }
    });
  });

  ttsManager.on('error', (error) => {
    const webContents = require('electron').webContents.getAllWebContents();
    webContents.forEach((wc) => {
      if (!wc.isDestroyed()) {
        wc.send('tts:error', error);
      }
    });
  });
}

module.exports = {
  initializeTTSManager,
  initializeTTSHandlers,
  cleanupTTSHandlers,
};
