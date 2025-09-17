/**
 * Echo Mobile App - Audio Provider
 * Manages audio recording, playback, and device state
 */

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

// Services
import { AudioManager } from '../services/AudioManager';
import { Logger } from '../utils/Logger';

// Initial State
const initialState = {
  // Recording State
  recording: {
    isRecording: false,
    isPaused: false,
    duration: 0,
    filePath: null,
    waveform: [],
    volume: 0,
  },

  // Playback State
  playback: {
    isPlaying: false,
    isPaused: false,
    duration: 0,
    currentTime: 0,
    filePath: null,
    volume: 0.8,
  },

  // Device State
  devices: {
    input: {
      available: [],
      selected: null,
      isConnected: false,
    },
    output: {
      available: [],
      selected: null,
      isConnected: false,
    },
  },

  // Audio Settings
  settings: {
    sampleRate: 44100,
    bitRate: 128000,
    channels: 1,
    format: 'mp4',
    quality: 'high',
    noiseReduction: true,
    echoCancellation: true,
    autoGainControl: true,
  },

  // Permissions
  permissions: {
    microphone: false,
    speaker: false,
  },

  // Status
  status: {
    isInitialized: false,
    error: null,
    loading: false,
  },
};

// Action Types
const ActionTypes = {
  // Recording Actions
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  PAUSE_RECORDING: 'PAUSE_RECORDING',
  RESUME_RECORDING: 'RESUME_RECORDING',
  UPDATE_RECORDING: 'UPDATE_RECORDING',

  // Playback Actions
  START_PLAYBACK: 'START_PLAYBACK',
  STOP_PLAYBACK: 'STOP_PLAYBACK',
  PAUSE_PLAYBACK: 'PAUSE_PLAYBACK',
  RESUME_PLAYBACK: 'RESUME_PLAYBACK',
  UPDATE_PLAYBACK: 'UPDATE_PLAYBACK',
  SET_PLAYBACK_VOLUME: 'SET_PLAYBACK_VOLUME',

  // Device Actions
  SET_DEVICES: 'SET_DEVICES',
  SELECT_INPUT_DEVICE: 'SELECT_INPUT_DEVICE',
  SELECT_OUTPUT_DEVICE: 'SELECT_OUTPUT_DEVICE',
  UPDATE_DEVICE_STATUS: 'UPDATE_DEVICE_STATUS',

  // Settings Actions
  UPDATE_AUDIO_SETTINGS: 'UPDATE_AUDIO_SETTINGS',

  // Permission Actions
  SET_PERMISSIONS: 'SET_PERMISSIONS',

  // Status Actions
  SET_INITIALIZED: 'SET_INITIALIZED',
  SET_ERROR: 'SET_ERROR',
  SET_LOADING: 'SET_LOADING',
};

// Reducer
const audioReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.START_RECORDING:
      return {
        ...state,
        recording: {
          ...state.recording,
          isRecording: true,
          isPaused: false,
          duration: 0,
          filePath: action.payload.filePath,
        },
      };

    case ActionTypes.STOP_RECORDING:
      return {
        ...state,
        recording: {
          ...initialState.recording,
          filePath: state.recording.filePath,
          duration: state.recording.duration,
        },
      };

    case ActionTypes.PAUSE_RECORDING:
      return {
        ...state,
        recording: {
          ...state.recording,
          isPaused: true,
        },
      };

    case ActionTypes.RESUME_RECORDING:
      return {
        ...state,
        recording: {
          ...state.recording,
          isPaused: false,
        },
      };

    case ActionTypes.UPDATE_RECORDING:
      return {
        ...state,
        recording: {
          ...state.recording,
          ...action.payload,
        },
      };

    case ActionTypes.START_PLAYBACK:
      return {
        ...state,
        playback: {
          ...state.playback,
          isPlaying: true,
          isPaused: false,
          filePath: action.payload.filePath,
          currentTime: 0,
        },
      };

    case ActionTypes.STOP_PLAYBACK:
      return {
        ...state,
        playback: {
          ...state.playback,
          isPlaying: false,
          isPaused: false,
          currentTime: 0,
        },
      };

    case ActionTypes.PAUSE_PLAYBACK:
      return {
        ...state,
        playback: {
          ...state.playback,
          isPaused: true,
        },
      };

    case ActionTypes.RESUME_PLAYBACK:
      return {
        ...state,
        playback: {
          ...state.playback,
          isPaused: false,
        },
      };

    case ActionTypes.UPDATE_PLAYBACK:
      return {
        ...state,
        playback: {
          ...state.playback,
          ...action.payload,
        },
      };

    case ActionTypes.SET_PLAYBACK_VOLUME:
      return {
        ...state,
        playback: {
          ...state.playback,
          volume: action.payload,
        },
      };

    case ActionTypes.SET_DEVICES:
      return {
        ...state,
        devices: {
          ...state.devices,
          ...action.payload,
        },
      };

    case ActionTypes.SELECT_INPUT_DEVICE:
      return {
        ...state,
        devices: {
          ...state.devices,
          input: {
            ...state.devices.input,
            selected: action.payload,
          },
        },
      };

    case ActionTypes.SELECT_OUTPUT_DEVICE:
      return {
        ...state,
        devices: {
          ...state.devices,
          output: {
            ...state.devices.output,
            selected: action.payload,
          },
        },
      };

    case ActionTypes.UPDATE_DEVICE_STATUS:
      return {
        ...state,
        devices: {
          ...state.devices,
          [action.payload.type]: {
            ...state.devices[action.payload.type],
            isConnected: action.payload.isConnected,
          },
        },
      };

    case ActionTypes.UPDATE_AUDIO_SETTINGS:
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };

    case ActionTypes.SET_PERMISSIONS:
      return {
        ...state,
        permissions: {
          ...state.permissions,
          ...action.payload,
        },
      };

    case ActionTypes.SET_INITIALIZED:
      return {
        ...state,
        status: {
          ...state.status,
          isInitialized: action.payload,
        },
      };

    case ActionTypes.SET_ERROR:
      return {
        ...state,
        status: {
          ...state.status,
          error: action.payload,
        },
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        status: {
          ...state.status,
          loading: action.payload,
        },
      };

    default:
      return state;
  }
};

// Context
const AudioContext = createContext();

// Provider Component
export const AudioProvider = ({ children }) => {
  const [state, dispatch] = useReducer(audioReducer, initialState);
  const appStateRef = useRef(AppState.currentState);
  const recordingTimerRef = useRef(null);
  const playbackTimerRef = useRef(null);

  // Initialize audio system
  useEffect(() => {
    initializeAudio();
    setupAppStateListener();

    return () => {
      cleanup();
    };
  }, []);

  // Update recording timer
  useEffect(() => {
    if (state.recording.isRecording && !state.recording.isPaused) {
      recordingTimerRef.current = setInterval(() => {
        dispatch({
          type: ActionTypes.UPDATE_RECORDING,
          payload: {
            duration: state.recording.duration + 1,
          },
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [state.recording.isRecording, state.recording.isPaused]);

  // Update playback timer
  useEffect(() => {
    if (state.playback.isPlaying && !state.playback.isPaused) {
      playbackTimerRef.current = setInterval(() => {
        dispatch({
          type: ActionTypes.UPDATE_PLAYBACK,
          payload: {
            currentTime: state.playback.currentTime + 1,
          },
        });
      }, 1000);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [state.playback.isPlaying, state.playback.isPaused]);

  const initializeAudio = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });

      // Initialize AudioManager
      await AudioManager.initialize();

      // Check permissions
      const permissions = await AudioManager.checkPermissions();
      dispatch({ type: ActionTypes.SET_PERMISSIONS, payload: permissions });

      // Get available devices
      const devices = await AudioManager.getAvailableDevices();
      dispatch({ type: ActionTypes.SET_DEVICES, payload: devices });

      dispatch({ type: ActionTypes.SET_INITIALIZED, payload: true });
      Logger.info('AudioProvider', 'Audio system initialized successfully');
    } catch (error) {
      Logger.error('AudioProvider', 'Failed to initialize audio system:', error);
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  };

  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        handleAppForeground();
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        handleAppBackground();
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const handleAppForeground = async () => {
    try {
      // Resume audio if needed
      if (state.recording.isPaused) {
        await AudioManager.resumeRecording();
      }
      if (state.playback.isPaused) {
        await AudioManager.resumePlayback();
      }
    } catch (error) {
      Logger.error('AudioProvider', 'Error resuming audio:', error);
    }
  };

  const handleAppBackground = async () => {
    try {
      // Pause audio if needed
      if (state.recording.isRecording && !state.recording.isPaused) {
        await AudioManager.pauseRecording();
        dispatch({ type: ActionTypes.PAUSE_RECORDING });
      }
      if (state.playback.isPlaying && !state.playback.isPaused) {
        await AudioManager.pausePlayback();
        dispatch({ type: ActionTypes.PAUSE_PLAYBACK });
      }
    } catch (error) {
      Logger.error('AudioProvider', 'Error pausing audio:', error);
    }
  };

  const cleanup = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }
    AudioManager.cleanup();
  };

  // Action Creators
  const actions = {
    // Recording Actions
    startRecording: async (options = {}) => {
      try {
        const result = await AudioManager.startRecording({
          ...state.settings,
          ...options,
        });
        dispatch({
          type: ActionTypes.START_RECORDING,
          payload: { filePath: result.filePath },
        });
        return result;
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to start recording:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    stopRecording: async () => {
      try {
        const result = await AudioManager.stopRecording();
        dispatch({ type: ActionTypes.STOP_RECORDING });
        return result;
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to stop recording:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    pauseRecording: async () => {
      try {
        await AudioManager.pauseRecording();
        dispatch({ type: ActionTypes.PAUSE_RECORDING });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to pause recording:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    resumeRecording: async () => {
      try {
        await AudioManager.resumeRecording();
        dispatch({ type: ActionTypes.RESUME_RECORDING });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to resume recording:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    // Playback Actions
    startPlayback: async (filePath, options = {}) => {
      try {
        const result = await AudioManager.startPlayback(filePath, {
          volume: state.playback.volume,
          ...options,
        });
        dispatch({
          type: ActionTypes.START_PLAYBACK,
          payload: { filePath, duration: result.duration },
        });
        return result;
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to start playback:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    stopPlayback: async () => {
      try {
        await AudioManager.stopPlayback();
        dispatch({ type: ActionTypes.STOP_PLAYBACK });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to stop playback:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    pausePlayback: async () => {
      try {
        await AudioManager.pausePlayback();
        dispatch({ type: ActionTypes.PAUSE_PLAYBACK });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to pause playback:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    resumePlayback: async () => {
      try {
        await AudioManager.resumePlayback();
        dispatch({ type: ActionTypes.RESUME_PLAYBACK });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to resume playback:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    setPlaybackVolume: async (volume) => {
      try {
        await AudioManager.setVolume(volume);
        dispatch({ type: ActionTypes.SET_PLAYBACK_VOLUME, payload: volume });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to set volume:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    // Device Actions
    selectInputDevice: async (deviceId) => {
      try {
        await AudioManager.selectInputDevice(deviceId);
        dispatch({ type: ActionTypes.SELECT_INPUT_DEVICE, payload: deviceId });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to select input device:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    selectOutputDevice: async (deviceId) => {
      try {
        await AudioManager.selectOutputDevice(deviceId);
        dispatch({ type: ActionTypes.SELECT_OUTPUT_DEVICE, payload: deviceId });
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to select output device:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    refreshDevices: async () => {
      try {
        const devices = await AudioManager.getAvailableDevices();
        dispatch({ type: ActionTypes.SET_DEVICES, payload: devices });
        return devices;
      } catch (error) {
        Logger.error('AudioProvider', 'Failed to refresh devices:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    // Settings Actions
    updateAudioSettings: (settings) => {
      dispatch({ type: ActionTypes.UPDATE_AUDIO_SETTINGS, payload: settings });
    },

    // Utility Actions
    clearError: () => {
      dispatch({ type: ActionTypes.SET_ERROR, payload: null });
    },
  };

  const value = {
    state,
    actions,
    dispatch,
  };

  return React.createElement(AudioContext.Provider, { value }, children);
};

// Hook
export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export default AudioProvider;