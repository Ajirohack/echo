const { ipcMain, app } = require('electron');
const AudioManager = require('../audio/AudioManager');
const logger = require('../utils/logger');
const audioUtils = require('../utils/audioUtils');
const path = require('path');

let audioManager = null;
let audioInitialized = false;

/**
 * Initialize all audio-related IPC handlers
 */
function initializeAudioHandlers() {
  if (audioManager) {
    logger.warn('Audio handlers already initialized');
    return audioManager;
  }
  
  logger.info('Initializing audio IPC handlers');
  
  try {
    // Create audio manager with platform-specific configurations
    audioManager = new AudioManager({
      // Common settings
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      
      // Platform-specific configurations
      ...(process.platform === 'win32' ? {
        // Windows specific settings
        wasapiLoopback: true,
        wasapiExclusive: false
      } : process.platform === 'darwin' ? {
        // macOS specific settings
        useDefaultInput: true,
        useDefaultOutput: true
      } : {
        // Linux/other platforms
        usePulseAudio: true,
        useAlsa: true
      })
    });
    
    // Set up device change listeners
    setupDeviceChangeListeners();
    
    // Initialize the audio manager
    audioManager.initialize()
      .then(() => {
        audioInitialized = true;
        logger.info('Audio manager initialized successfully');
      })
      .catch(err => {
        logger.error('Failed to initialize audio manager:', err);
      });
      
  } catch (error) {
    logger.error('Error creating audio manager:', error);
    throw error;
  }
  
  // Get available audio devices
  ipcMain.handle('audio:getDevices', async () => {
    try {
      logger.debug('Getting audio devices');
      if (!audioManager) {
        throw new Error('Audio manager not initialized');
      }
      
      const devices = await audioManager.getDevices();
      
      // Ensure we have the expected structure
      return {
        inputs: Array.isArray(devices.inputs) ? devices.inputs : [],
        outputs: Array.isArray(devices.outputs) ? devices.outputs : [],
        virtuals: Array.isArray(devices.virtuals) ? devices.virtuals : []
      };
      
    } catch (error) {
      logger.error('Error getting audio devices:', error);
      return { 
        inputs: [], 
        outputs: [],
        virtuals: [],
        error: error.message 
      };
    }
  });
  
  // Start audio capture with options
  ipcMain.handle('audio:startCapture', async (event, { deviceId, sampleRate, channels, bitDepth }) => {
    try {
      if (!audioManager) {
        throw new Error('Audio manager not initialized');
      }
      
      logger.info(`Starting audio capture for device: ${deviceId}`, { sampleRate, channels, bitDepth });
      
      // Set up callback for audio data
      const onAudioData = (audioData, metadata = {}) => {
        if (!event.sender.isDestroyed()) {
          // Send audio data back to renderer
          event.sender.send('audio:data', {
            deviceId,
            data: audioData.buffer || audioData,
            sampleRate: metadata.sampleRate || sampleRate || 16000,
            channels: metadata.channels || channels || 1,
            bitDepth: metadata.bitDepth || bitDepth || 16,
            timestamp: Date.now()
          });
        }
      };
      
      // Start capture with the provided options
      const result = await audioManager.startCapture(deviceId, {
        sampleRate: sampleRate || 16000,
        channels: channels || 1,
        bitDepth: bitDepth || 16,
        onData: onAudioData,
        onError: (error) => {
          logger.error('Audio capture error:', error);
          if (!event.sender.isDestroyed()) {
            event.sender.send('audio:error', { 
              deviceId,
              error: error.message || 'Unknown audio capture error',
              timestamp: Date.now()
            });
          }
        }
      });
      
      logger.info('Audio capture started successfully', { deviceId, result });
      return result;
      
    } catch (error) {
      const errorMsg = `Error in audio:startCapture: ${error.message}`;
      logger.error(errorMsg, { error, deviceId });
      return { 
        success: false, 
        error: errorMsg,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  });
  
  // Stop audio capture
  ipcMain.handle('audio:stopCapture', async () => {
    try {
      logger.info('Stopping audio capture');
      return await audioManager.stopCapture();
    } catch (error) {
      logger.error('Error in audio:stopCapture:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Route audio to output device
  ipcMain.handle('audio:routeAudio', async (event, { deviceId, audioData }) => {
    try {
      logger.debug(`Routing audio to device: ${deviceId}`);
      return await audioManager.routeAudio(deviceId, audioData);
    } catch (error) {
      logger.error('Error in audio:routeAudio:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Get current audio levels
  ipcMain.handle('audio:getLevels', async () => {
    try {
      if (!audioManager || !audioInitialized) {
        return { input: 0, output: 0 };
      }
      
      // Get levels from audio manager if available
      if (typeof audioManager.getAudioLevels === 'function') {
        const levels = await audioManager.getAudioLevels();
        return {
          input: typeof levels.input === 'number' ? levels.input : 0,
          output: typeof levels.output === 'number' ? levels.output : 0,
          timestamp: Date.now()
        };
      }
      
      // Fallback to random levels for testing
      return { 
        input: Math.random() * 0.5, // Lower random values for input
        output: Math.random() * 0.3, // Even lower for output
        timestamp: Date.now()
      };
      
    } catch (error) {
      logger.error('Error in audio:getLevels:', error);
      return { 
        input: 0, 
        output: 0, 
        error: error.message,
        timestamp: Date.now()
      };
    }
  });
  
  // Handle audio initialization
  ipcMain.handle('audio:initialize', async () => {
    try {
      if (!audioManager) {
        throw new Error('Audio manager not created');
      }
      
      if (audioInitialized) {
        return { success: true, alreadyInitialized: true };
      }
      
      logger.info('Initializing audio system...');
      await audioManager.initialize();
      audioInitialized = true;
      
      return { success: true };
      
    } catch (error) {
      logger.error('Error initializing audio system:', error);
      return { 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  });
  
  // Get virtual device installation guide
  ipcMain.handle('audio:getVirtualDeviceGuide', async () => {
    try {
      // Check if we have virtual devices
      const devices = await audioManager.getDevices();
      const hasVirtualDevices = devices.virtuals && devices.virtuals.length > 0;
      
      if (hasVirtualDevices) {
        return null; // No guide needed if virtual devices are available
      }
      
      // Get installation guide for the current platform
      const guide = await audioUtils.getVirtualDeviceInstallationInstructions();
      
      // Add platform-specific download links
      if (process.platform === 'win32') {
        guide.downloadUrl = 'https://vb-audio.com/Cable/';
      } else if (process.platform === 'darwin') {
        guide.downloadUrl = 'https://github.com/ExistentialAudio/BlackHole';
      } else if (process.platform === 'linux') {
        guide.downloadUrl = 'https://github.com/JackAudio/jackaudio.github.com/wiki';
      }
      
      return guide;
      
    } catch (error) {
      logger.error('Error getting virtual device guide:', error);
      return {
        platform: process.platform,
        instructions: 'Failed to load installation instructions.',
        error: error.message
      };
    }
  });
  
  // Set up device change listeners
  function setupDeviceChangeListeners() {
    if (!audioManager) return;
    
    // Listen for device changes
    audioManager.on('devicesChanged', (devices) => {
      // Notify all renderer processes
      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('audio:devicesUpdated', {
            inputs: Array.isArray(devices.inputs) ? devices.inputs : [],
            outputs: Array.isArray(devices.outputs) ? devices.outputs : [],
            virtuals: Array.isArray(devices.virtuals) ? devices.virtuals : []
          });
        }
      });
    });
    
    // Handle app focus events to refresh devices
    app.on('browser-window-focus', () => {
      if (audioManager) {
        audioManager.refreshDevices().catch(err => {
          logger.error('Error refreshing devices on window focus:', err);
        });
      }
    });
  }
  
  // Clean up audio resources
  ipcMain.handle('audio:cleanup', async () => {
    try {
      logger.info('Cleaning up audio resources');
      if (audioManager) {
        audioManager.cleanup();
        audioManager = null;
      }
      return { success: true };
    } catch (error) {
      logger.error('Error in audio:cleanup:', error);
      return { success: false, error: error.message };
    }
  });
  
  return audioManager;
}

/**
 * Clean up audio handlers and resources
 */
function cleanupAudioHandlers() {
  const cleanupTasks = [];
  
  // Clean up audio manager if it exists
  if (audioManager) {
    logger.info('Cleaning up audio manager...');
    try {
      cleanupTasks.push(
        Promise.resolve()
          .then(() => audioManager.cleanup())
          .catch(error => {
            logger.error('Error during audio manager cleanup:', error);
          })
      );
    } catch (error) {
      logger.error('Error preparing audio manager cleanup:', error);
    }
    audioManager = null;
  }
  
  // Reset initialization flag
  audioInitialized = false;
  
  // Remove all IPC handlers
  const ipcHandlers = [
    'audio:getDevices',
    'audio:startCapture',
    'audio:stopCapture',
    'audio:routeAudio',
    'audio:getLevels',
    'audio:cleanup',
    'audio:initialize',
    'audio:getVirtualDeviceGuide'
  ];
  
  ipcHandlers.forEach(handler => {
    try {
      if (ipcMain.removeHandler) {
        ipcMain.removeHandler(handler);
      } else {
        // Fallback for older Electron versions
        ipcMain._events = Object.entries(ipcMain._events || {})
          .filter(([event]) => !event.startsWith(handler))
          .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
      }
    } catch (error) {
      logger.error(`Error removing IPC handler ${handler}:`, error);
    }
  });
  
  // Wait for all cleanup tasks to complete
  return Promise.all(cleanupTasks)
    .then(() => {
      logger.info('Audio handlers cleaned up successfully');
      return { success: true };
    })
    .catch(error => {
      logger.error('Error during audio handler cleanup:', error);
      return { 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    });
}

module.exports = {
  initializeAudioHandlers,
  cleanupAudioHandlers
};
