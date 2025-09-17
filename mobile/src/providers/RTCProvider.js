/**
 * Echo Mobile App - RTC Provider
 * Manages WebRTC connections and real-time communication
 */

import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

// Services
import { RTCManager } from '../services/RTCManager';
import { Logger } from '../utils/Logger';

// Initial State
const initialState = {
  // Connection State
  connection: {
    status: 'disconnected', // disconnected, connecting, connected, reconnecting, failed
    roomId: null,
    userId: null,
    sessionId: null,
    quality: 'good', // poor, fair, good, excellent
    latency: 0,
    bandwidth: {
      upload: 0,
      download: 0,
    },
  },

  // Local Stream
  localStream: {
    audio: {
      enabled: true,
      muted: false,
      volume: 1.0,
      deviceId: null,
    },
    video: {
      enabled: false,
      muted: false,
      deviceId: null,
      resolution: '720p',
    },
    stream: null,
  },

  // Remote Participants
  participants: {},

  // Room State
  room: {
    id: null,
    name: null,
    isHost: false,
    maxParticipants: 10,
    participantCount: 0,
    settings: {
      audioOnly: true,
      recordingEnabled: false,
      translationEnabled: true,
      qualityMode: 'auto',
    },
  },

  // Statistics
  stats: {
    packetsLost: 0,
    packetsReceived: 0,
    packetsSent: 0,
    bytesReceived: 0,
    bytesSent: 0,
    jitter: 0,
    rtt: 0,
    audioLevel: 0,
  },

  // Error State
  error: null,

  // Loading State
  loading: false,

  // Initialization State
  initialized: false,
};

// Action Types
const ActionTypes = {
  // Connection Actions
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  SET_CONNECTION_QUALITY: 'SET_CONNECTION_QUALITY',
  SET_CONNECTION_STATS: 'SET_CONNECTION_STATS',

  // Stream Actions
  SET_LOCAL_STREAM: 'SET_LOCAL_STREAM',
  UPDATE_LOCAL_AUDIO: 'UPDATE_LOCAL_AUDIO',
  UPDATE_LOCAL_VIDEO: 'UPDATE_LOCAL_VIDEO',

  // Participant Actions
  ADD_PARTICIPANT: 'ADD_PARTICIPANT',
  REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',
  UPDATE_PARTICIPANT: 'UPDATE_PARTICIPANT',
  SET_PARTICIPANTS: 'SET_PARTICIPANTS',

  // Room Actions
  SET_ROOM_INFO: 'SET_ROOM_INFO',
  UPDATE_ROOM_SETTINGS: 'UPDATE_ROOM_SETTINGS',
  SET_PARTICIPANT_COUNT: 'SET_PARTICIPANT_COUNT',

  // Statistics Actions
  UPDATE_STATS: 'UPDATE_STATS',

  // General Actions
  SET_ERROR: 'SET_ERROR',
  SET_LOADING: 'SET_LOADING',
  SET_INITIALIZED: 'SET_INITIALIZED',
};

// Reducer
const rtcReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_CONNECTION_STATUS:
      return {
        ...state,
        connection: {
          ...state.connection,
          status: action.payload.status,
          roomId: action.payload.roomId || state.connection.roomId,
          userId: action.payload.userId || state.connection.userId,
          sessionId: action.payload.sessionId || state.connection.sessionId,
        },
      };

    case ActionTypes.SET_CONNECTION_QUALITY:
      return {
        ...state,
        connection: {
          ...state.connection,
          quality: action.payload.quality,
          latency: action.payload.latency || state.connection.latency,
          bandwidth: action.payload.bandwidth || state.connection.bandwidth,
        },
      };

    case ActionTypes.SET_CONNECTION_STATS:
      return {
        ...state,
        connection: {
          ...state.connection,
          ...action.payload,
        },
      };

    case ActionTypes.SET_LOCAL_STREAM:
      return {
        ...state,
        localStream: {
          ...state.localStream,
          stream: action.payload,
        },
      };

    case ActionTypes.UPDATE_LOCAL_AUDIO:
      return {
        ...state,
        localStream: {
          ...state.localStream,
          audio: {
            ...state.localStream.audio,
            ...action.payload,
          },
        },
      };

    case ActionTypes.UPDATE_LOCAL_VIDEO:
      return {
        ...state,
        localStream: {
          ...state.localStream,
          video: {
            ...state.localStream.video,
            ...action.payload,
          },
        },
      };

    case ActionTypes.ADD_PARTICIPANT:
      return {
        ...state,
        participants: {
          ...state.participants,
          [action.payload.id]: action.payload,
        },
      };

    case ActionTypes.REMOVE_PARTICIPANT:
      const { [action.payload]: removed, ...remainingParticipants } = state.participants;
      return {
        ...state,
        participants: remainingParticipants,
      };

    case ActionTypes.UPDATE_PARTICIPANT:
      return {
        ...state,
        participants: {
          ...state.participants,
          [action.payload.id]: {
            ...state.participants[action.payload.id],
            ...action.payload.updates,
          },
        },
      };

    case ActionTypes.SET_PARTICIPANTS:
      return {
        ...state,
        participants: action.payload,
      };

    case ActionTypes.SET_ROOM_INFO:
      return {
        ...state,
        room: {
          ...state.room,
          ...action.payload,
        },
      };

    case ActionTypes.UPDATE_ROOM_SETTINGS:
      return {
        ...state,
        room: {
          ...state.room,
          settings: {
            ...state.room.settings,
            ...action.payload,
          },
        },
      };

    case ActionTypes.SET_PARTICIPANT_COUNT:
      return {
        ...state,
        room: {
          ...state.room,
          participantCount: action.payload,
        },
      };

    case ActionTypes.UPDATE_STATS:
      return {
        ...state,
        stats: {
          ...state.stats,
          ...action.payload,
        },
      };

    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case ActionTypes.SET_INITIALIZED:
      return {
        ...state,
        initialized: action.payload,
      };

    default:
      return state;
  }
};

// Context
const RTCContext = createContext();

// Provider Component
export const RTCProvider = ({ children }) => {
  const [state, dispatch] = useReducer(rtcReducer, initialState);
  const appStateRef = useRef(AppState.currentState);
  const statsIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const rtcManagerRef = useRef(null);

  // Initialize RTC system
  useEffect(() => {
    initializeRTC();
    setupAppStateListener();

    return () => {
      cleanup();
    };
  }, []);

  // Start stats monitoring when connected
  useEffect(() => {
    if (state.connection.status === 'connected') {
      startStatsMonitoring();
    } else {
      stopStatsMonitoring();
    }

    return () => {
      stopStatsMonitoring();
    };
  }, [state.connection.status]);

  const initializeRTC = async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });

      // Initialize RTCManager
      rtcManagerRef.current = new RTCManager();
      await rtcManagerRef.current.initialize();

      // Setup event listeners
      setupRTCEventListeners();

      dispatch({ type: ActionTypes.SET_INITIALIZED, payload: true });
      Logger.info('RTCProvider', 'RTC system initialized successfully');
    } catch (error) {
      Logger.error('RTCProvider', 'Failed to initialize RTC system:', error);
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  };

  const setupRTCEventListeners = () => {
    const rtcManager = rtcManagerRef.current;
    if (!rtcManager) return;

    // Connection events
    rtcManager.on('connectionStateChange', (status) => {
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status } });

      if (status === 'failed') {
        handleConnectionFailure();
      }
    });

    // Participant events
    rtcManager.on('participantJoined', (participant) => {
      dispatch({ type: ActionTypes.ADD_PARTICIPANT, payload: participant });
      dispatch({ type: ActionTypes.SET_PARTICIPANT_COUNT, payload: Object.keys(state.participants).length + 1 });
    });

    rtcManager.on('participantLeft', (participantId) => {
      dispatch({ type: ActionTypes.REMOVE_PARTICIPANT, payload: participantId });
      dispatch({ type: ActionTypes.SET_PARTICIPANT_COUNT, payload: Object.keys(state.participants).length - 1 });
    });

    rtcManager.on('participantUpdated', (participantId, updates) => {
      dispatch({ type: ActionTypes.UPDATE_PARTICIPANT, payload: { id: participantId, updates } });
    });

    // Stream events
    rtcManager.on('localStreamReady', (stream) => {
      dispatch({ type: ActionTypes.SET_LOCAL_STREAM, payload: stream });
    });

    // Quality events
    rtcManager.on('qualityChanged', (quality, metrics) => {
      dispatch({ type: ActionTypes.SET_CONNECTION_QUALITY, payload: { quality, ...metrics } });
    });

    // Error events
    rtcManager.on('error', (error) => {
      Logger.error('RTCProvider', 'RTC error:', error);
      dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
    });
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
      if (state.connection.status === 'connected') {
        // Resume audio/video if needed
        await actions.resumeLocalAudio();
      } else if (state.connection.roomId) {
        // Attempt to reconnect
        await actions.reconnect();
      }
    } catch (error) {
      Logger.error('RTCProvider', 'Error handling app foreground:', error);
    }
  };

  const handleAppBackground = async () => {
    try {
      if (state.connection.status === 'connected') {
        // Pause video to save bandwidth
        if (state.localStream.video.enabled) {
          await actions.muteLocalVideo();
        }
      }
    } catch (error) {
      Logger.error('RTCProvider', 'Error handling app background:', error);
    }
  };

  const handleConnectionFailure = () => {
    // Attempt to reconnect after a delay
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      if (state.connection.roomId) {
        actions.reconnect();
      }
    }, 3000);
  };

  const startStatsMonitoring = () => {
    if (statsIntervalRef.current) return;

    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await rtcManagerRef.current?.getStats();
        if (stats) {
          dispatch({ type: ActionTypes.UPDATE_STATS, payload: stats });
        }
      } catch (error) {
        Logger.error('RTCProvider', 'Error getting stats:', error);
      }
    }, 5000);
  };

  const stopStatsMonitoring = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  const cleanup = () => {
    stopStatsMonitoring();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (rtcManagerRef.current) {
      rtcManagerRef.current.cleanup();
    }
  };

  // Action Creators
  const actions = {
    // Connection Actions
    joinRoom: async (roomId, userId, options = {}) => {
      try {
        dispatch({ type: ActionTypes.SET_LOADING, payload: true });
        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status: 'connecting', roomId, userId } });

        const result = await rtcManagerRef.current.joinRoom(roomId, userId, options);

        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status: 'connected' } });
        dispatch({ type: ActionTypes.SET_ROOM_INFO, payload: result.room });
        dispatch({ type: ActionTypes.SET_PARTICIPANTS, payload: result.participants });

        return result;
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to join room:', error);
        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status: 'failed' } });
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    },

    leaveRoom: async () => {
      try {
        await rtcManagerRef.current.leaveRoom();

        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status: 'disconnected', roomId: null, userId: null } });
        dispatch({ type: ActionTypes.SET_PARTICIPANTS, payload: {} });
        dispatch({ type: ActionTypes.SET_ROOM_INFO, payload: initialState.room });
        dispatch({ type: ActionTypes.SET_LOCAL_STREAM, payload: null });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to leave room:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    reconnect: async () => {
      try {
        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status: 'reconnecting' } });

        await rtcManagerRef.current.reconnect();

        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status: 'connected' } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to reconnect:', error);
        dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: { status: 'failed' } });
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    // Local Stream Actions
    enableLocalAudio: async () => {
      try {
        await rtcManagerRef.current.enableLocalAudio();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_AUDIO, payload: { enabled: true, muted: false } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to enable local audio:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    disableLocalAudio: async () => {
      try {
        await rtcManagerRef.current.disableLocalAudio();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_AUDIO, payload: { enabled: false } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to disable local audio:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    muteLocalAudio: async () => {
      try {
        await rtcManagerRef.current.muteLocalAudio();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_AUDIO, payload: { muted: true } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to mute local audio:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    unmuteLocalAudio: async () => {
      try {
        await rtcManagerRef.current.unmuteLocalAudio();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_AUDIO, payload: { muted: false } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to unmute local audio:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    resumeLocalAudio: async () => {
      try {
        if (!state.localStream.audio.enabled) {
          await actions.enableLocalAudio();
        }
        if (state.localStream.audio.muted) {
          await actions.unmuteLocalAudio();
        }
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to resume local audio:', error);
        throw error;
      }
    },

    enableLocalVideo: async () => {
      try {
        await rtcManagerRef.current.enableLocalVideo();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_VIDEO, payload: { enabled: true, muted: false } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to enable local video:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    disableLocalVideo: async () => {
      try {
        await rtcManagerRef.current.disableLocalVideo();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_VIDEO, payload: { enabled: false } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to disable local video:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    muteLocalVideo: async () => {
      try {
        await rtcManagerRef.current.muteLocalVideo();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_VIDEO, payload: { muted: true } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to mute local video:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    unmuteLocalVideo: async () => {
      try {
        await rtcManagerRef.current.unmuteLocalVideo();
        dispatch({ type: ActionTypes.UPDATE_LOCAL_VIDEO, payload: { muted: false } });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to unmute local video:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    // Room Actions
    updateRoomSettings: async (settings) => {
      try {
        await rtcManagerRef.current.updateRoomSettings(settings);
        dispatch({ type: ActionTypes.UPDATE_ROOM_SETTINGS, payload: settings });
      } catch (error) {
        Logger.error('RTCProvider', 'Failed to update room settings:', error);
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        throw error;
      }
    },

    // Utility Actions
    clearError: () => {
      dispatch({ type: ActionTypes.SET_ERROR, payload: null });
    },

    getConnectionStats: () => {
      return state.stats;
    },

    getParticipants: () => {
      return Object.values(state.participants);
    },
  };

  const value = {
    state,
    actions,
    dispatch,
  };

  return React.createElement(RTCContext.Provider, { value }, children);
};

// Hook
export const useRTC = () => {
  const context = useContext(RTCContext);
  if (!context) {
    throw new Error('useRTC must be used within an RTCProvider');
  }
  return context;
};

export default RTCProvider;