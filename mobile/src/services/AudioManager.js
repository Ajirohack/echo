/**
 * Echo Mobile App - Audio Manager Service
 * Handles audio recording, playback, and device management
 */

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Utils
import { Logger } from '../utils/Logger';
import { EventEmitter } from '../utils/EventEmitter';

class AudioManagerService extends EventEmitter {
  constructor() {
    super();

    this.recording = null;
    this.sound = null;
    this.isInitialized = false;
    this.recordingSettings = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };

    this.playbackSettings = {
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    };

    this.recordingStatus = {
      isRecording: false,
      isPaused: false,
      duration: 0,
      filePath: null,
    };

    this.playbackStatus = {
      isPlaying: false,
      isPaused: false,
      duration: 0,
      currentTime: 0,
      volume: 1.0,
    };
  }

  /**
   * Initialize the audio system
   */
  async initialize() {
    try {
      Logger.info('AudioManager', 'Initializing audio system...');

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      this.isInitialized = true;
      this.emit('initialized');

      Logger.info('AudioManager', 'Audio system initialized successfully');
    } catch (error) {
      Logger.error('AudioManager', 'Failed to initialize audio system:', error);
      throw error;
    }
  }

  /**
   * Check audio permissions
   */
  async checkPermissions() {
    try {
      const { status: recordingStatus } = await Audio.requestPermissionsAsync();

      return {
        microphone: recordingStatus === 'granted',
        speaker: true, // Speaker permission is always granted
      };
    } catch (error) {
      Logger.error('AudioManager', 'Failed to check permissions:', error);
      return {
        microphone: false,
        speaker: false,
      };
    }
  }

  /**
   * Get available audio devices
   */
  async getAvailableDevices() {
    try {
      // Note: Expo doesn't provide detailed device enumeration
      // This is a simplified implementation
      const devices = {
        input: {
          available: [
            { id: 'default', name: 'Default Microphone', type: 'microphone' },
          ],
          selected: 'default',
          isConnected: true,
        },
        output: {
          available: [
            { id: 'default', name: 'Default Speaker', type: 'speaker' },
          ],
          selected: 'default',
          isConnected: true,
        },
      };

      // Add Bluetooth devices if available (simplified)
      if (Platform.OS === 'ios') {
        devices.output.available.push(
          { id: 'bluetooth', name: 'Bluetooth Device', type: 'bluetooth' }
        );
      }

      return devices;
    } catch (error) {
      Logger.error('AudioManager', 'Failed to get available devices:', error);
      throw error;
    }
  }

  /**
   * Start audio recording
   */
  async startRecording(options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('AudioManager not initialized');
      }

      if (this.recording) {
        throw new Error('Recording already in progress');
      }

      Logger.info('AudioManager', 'Starting recording...');

      // Check permissions
      const permissions = await this.checkPermissions();
      if (!permissions.microphone) {
        throw new Error('Microphone permission not granted');
      }

      // Create recording settings
      const recordingOptions = {
        ...this.recordingSettings[Platform.OS],
        ...options,
      };

      // Generate file path
      const fileName = `recording_${Date.now()}${recordingOptions.extension || '.m4a'}`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      // Create and start recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();

      // Update status
      this.recordingStatus = {
        isRecording: true,
        isPaused: false,
        duration: 0,
        filePath,
      };

      // Setup status updates
      this.recording.setOnRecordingStatusUpdate((status) => {
        this.recordingStatus.duration = status.durationMillis || 0;
        this.emit('recordingStatusUpdate', this.recordingStatus);
      });

      this.emit('recordingStarted', { filePath });
      Logger.info('AudioManager', 'Recording started successfully');

      return { filePath };
    } catch (error) {
      Logger.error('AudioManager', 'Failed to start recording:', error);
      this.recording = null;
      throw error;
    }
  }

  /**
   * Stop audio recording
   */
  async stopRecording() {
    try {
      if (!this.recording) {
        throw new Error('No recording in progress');
      }

      Logger.info('AudioManager', 'Stopping recording...');

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);

      const result = {
        filePath: uri,
        duration: this.recordingStatus.duration,
        size: fileInfo.size,
      };

      // Reset status
      this.recordingStatus = {
        isRecording: false,
        isPaused: false,
        duration: 0,
        filePath: null,
      };

      this.recording = null;

      this.emit('recordingStopped', result);
      Logger.info('AudioManager', 'Recording stopped successfully');

      return result;
    } catch (error) {
      Logger.error('AudioManager', 'Failed to stop recording:', error);
      throw error;
    }
  }

  /**
   * Pause audio recording
   */
  async pauseRecording() {
    try {
      if (!this.recording || !this.recordingStatus.isRecording) {
        throw new Error('No recording in progress');
      }

      await this.recording.pauseAsync();
      this.recordingStatus.isPaused = true;

      this.emit('recordingPaused');
      Logger.info('AudioManager', 'Recording paused');
    } catch (error) {
      Logger.error('AudioManager', 'Failed to pause recording:', error);
      throw error;
    }
  }

  /**
   * Resume audio recording
   */
  async resumeRecording() {
    try {
      if (!this.recording || !this.recordingStatus.isPaused) {
        throw new Error('No paused recording to resume');
      }

      await this.recording.startAsync();
      this.recordingStatus.isPaused = false;

      this.emit('recordingResumed');
      Logger.info('AudioManager', 'Recording resumed');
    } catch (error) {
      Logger.error('AudioManager', 'Failed to resume recording:', error);
      throw error;
    }
  }

  /**
   * Start audio playback
   */
  async startPlayback(filePath, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('AudioManager not initialized');
      }

      if (this.sound) {
        await this.stopPlayback();
      }

      Logger.info('AudioManager', 'Starting playback:', filePath);

      // Create sound object
      const { sound } = await Audio.Sound.createAsync(
        { uri: filePath },
        {
          ...this.playbackSettings,
          volume: options.volume || 1.0,
          rate: options.rate || 1.0,
          shouldCorrectPitch: options.shouldCorrectPitch || true,
        }
      );

      this.sound = sound;

      // Setup status updates
      this.sound.setOnPlaybackStatusUpdate((status) => {
        this.playbackStatus = {
          isPlaying: status.isPlaying || false,
          isPaused: !status.isPlaying && status.positionMillis > 0,
          duration: status.durationMillis || 0,
          currentTime: status.positionMillis || 0,
          volume: status.volume || 1.0,
        };

        this.emit('playbackStatusUpdate', this.playbackStatus);

        if (status.didJustFinish) {
          this.emit('playbackFinished');
          this.stopPlayback();
        }
      });

      // Start playback
      await this.sound.playAsync();

      const status = await this.sound.getStatusAsync();

      this.emit('playbackStarted', {
        filePath,
        duration: status.durationMillis,
      });

      Logger.info('AudioManager', 'Playback started successfully');

      return {
        duration: status.durationMillis,
      };
    } catch (error) {
      Logger.error('AudioManager', 'Failed to start playback:', error);
      throw error;
    }
  }

  /**
   * Stop audio playback
   */
  async stopPlayback() {
    try {
      if (!this.sound) {
        return;
      }

      Logger.info('AudioManager', 'Stopping playback...');

      await this.sound.stopAsync();
      await this.sound.unloadAsync();

      this.sound = null;

      this.playbackStatus = {
        isPlaying: false,
        isPaused: false,
        duration: 0,
        currentTime: 0,
        volume: 1.0,
      };

      this.emit('playbackStopped');
      Logger.info('AudioManager', 'Playback stopped successfully');
    } catch (error) {
      Logger.error('AudioManager', 'Failed to stop playback:', error);
      throw error;
    }
  }

  /**
   * Pause audio playback
   */
  async pausePlayback() {
    try {
      if (!this.sound) {
        throw new Error('No playback in progress');
      }

      await this.sound.pauseAsync();

      this.emit('playbackPaused');
      Logger.info('AudioManager', 'Playback paused');
    } catch (error) {
      Logger.error('AudioManager', 'Failed to pause playback:', error);
      throw error;
    }
  }

  /**
   * Resume audio playback
   */
  async resumePlayback() {
    try {
      if (!this.sound) {
        throw new Error('No paused playback to resume');
      }

      await this.sound.playAsync();

      this.emit('playbackResumed');
      Logger.info('AudioManager', 'Playback resumed');
    } catch (error) {
      Logger.error('AudioManager', 'Failed to resume playback:', error);
      throw error;
    }
  }

  /**
   * Set playback volume
   */
  async setVolume(volume) {
    try {
      if (!this.sound) {
        throw new Error('No playback in progress');
      }

      const clampedVolume = Math.max(0, Math.min(1, volume));
      await this.sound.setVolumeAsync(clampedVolume);

      this.playbackStatus.volume = clampedVolume;
      this.emit('volumeChanged', clampedVolume);

      Logger.info('AudioManager', 'Volume set to:', clampedVolume);
    } catch (error) {
      Logger.error('AudioManager', 'Failed to set volume:', error);
      throw error;
    }
  }

  /**
   * Seek to position in playback
   */
  async seekTo(positionMillis) {
    try {
      if (!this.sound) {
        throw new Error('No playback in progress');
      }

      await this.sound.setPositionAsync(positionMillis);

      this.emit('seeked', positionMillis);
      Logger.info('AudioManager', 'Seeked to position:', positionMillis);
    } catch (error) {
      Logger.error('AudioManager', 'Failed to seek:', error);
      throw error;
    }
  }

  /**
   * Select input device
   */
  async selectInputDevice(deviceId) {
    try {
      // Note: Expo doesn't provide detailed device selection
      // This is a placeholder implementation
      Logger.info('AudioManager', 'Input device selected:', deviceId);
      this.emit('inputDeviceChanged', deviceId);
    } catch (error) {
      Logger.error('AudioManager', 'Failed to select input device:', error);
      throw error;
    }
  }

  /**
   * Select output device
   */
  async selectOutputDevice(deviceId) {
    try {
      // Note: Expo doesn't provide detailed device selection
      // This is a placeholder implementation
      Logger.info('AudioManager', 'Output device selected:', deviceId);
      this.emit('outputDeviceChanged', deviceId);
    } catch (error) {
      Logger.error('AudioManager', 'Failed to select output device:', error);
      throw error;
    }
  }

  /**
   * Get current recording status
   */
  getRecordingStatus() {
    return { ...this.recordingStatus };
  }

  /**
   * Get current playback status
   */
  getPlaybackStatus() {
    return { ...this.playbackStatus };
  }

  /**
   * Delete audio file
   */
  async deleteFile(filePath) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        Logger.info('AudioManager', 'File deleted:', filePath);
      }
    } catch (error) {
      Logger.error('AudioManager', 'Failed to delete file:', error);
      throw error;
    }
  }

  /**
   * Get audio file info
   */
  async getFileInfo(filePath) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return {
        exists: fileInfo.exists,
        size: fileInfo.size,
        modificationTime: fileInfo.modificationTime,
        uri: fileInfo.uri,
      };
    } catch (error) {
      Logger.error('AudioManager', 'Failed to get file info:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      Logger.info('AudioManager', 'Cleaning up audio resources...');

      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }

      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      }

      this.removeAllListeners();
      this.isInitialized = false;

      Logger.info('AudioManager', 'Audio resources cleaned up successfully');
    } catch (error) {
      Logger.error('AudioManager', 'Error during cleanup:', error);
    }
  }
}

// Export singleton instance
export const AudioManager = new AudioManagerService();
export default AudioManager;