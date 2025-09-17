/**
 * Echo Mobile App - Main Echo Provider
 * Manages global app state and core Echo services
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Services
import { EchoRTCService } from '../services/EchoRTCService';
import { Logger } from '../utils/Logger';

// Initial State
const initialState = {
  // User State
  user: {
    id: null,
    name: null,
    avatar: null,
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: true,
    },
  },

  // App State
  app: {
    isInitialized: false,
    isOnboarded: false,
    version: '1.0.0',
    buildNumber: 1,
  },

  // Session State
  session: {
    isActive: false,
    roomId: null,
    participants: [],
    startTime: null,
    duration: 0,
  },

  // Settings State
  settings: {
    audio: {
      inputDevice: 'default',
      outputDevice: 'default',
      volume: 0.8,
      noiseReduction: true,
      echoCancellation: true,
    },
    translation: {
      sourceLanguage: 'en',
      targetLanguage: 'es',
      autoDetect: true,
      realTimeMode: true,
    },
    network: {
      quality: 'auto',
      bandwidth: 'auto',
      serverRegion: 'auto',
    },
  },

  // UI State
  ui: {
    loading: false,
    error: null,
    notifications: [],
    modals: {
      languageSelector: false,
      audioSettings: false,
      profile: false,
    },
  },
};

// Action Types
const ActionTypes = {
  // User Actions
  SET_USER: 'SET_USER',
  UPDATE_USER_PREFERENCES: 'UPDATE_USER_PREFERENCES',

  // App Actions
  SET_INITIALIZED: 'SET_INITIALIZED',
  SET_ONBOARDED: 'SET_ONBOARDED',

  // Session Actions
  START_SESSION: 'START_SESSION',
  END_SESSION: 'END_SESSION',
  UPDATE_SESSION: 'UPDATE_SESSION',
  ADD_PARTICIPANT: 'ADD_PARTICIPANT',
  REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',

  // Settings Actions
  UPDATE_AUDIO_SETTINGS: 'UPDATE_AUDIO_SETTINGS',
  UPDATE_TRANSLATION_SETTINGS: 'UPDATE_TRANSLATION_SETTINGS',
  UPDATE_NETWORK_SETTINGS: 'UPDATE_NETWORK_SETTINGS',

  // UI Actions
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  TOGGLE_MODAL: 'TOGGLE_MODAL',
};

// Reducer
const echoReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case ActionTypes.UPDATE_USER_PREFERENCES:
      return {
        ...state,
        user: {
          ...state.user,
          preferences: { ...state.user.preferences, ...action.payload },
        },
      };

    case ActionTypes.SET_INITIALIZED:
      return {
        ...state,
        app: { ...state.app, isInitialized: action.payload },
      };

    case ActionTypes.SET_ONBOARDED:
      return {
        ...state,
        app: { ...state.app, isOnboarded: action.payload },
      };

    case ActionTypes.START_SESSION:
      return {
        ...state,
        session: {
          ...state.session,
          isActive: true,
          roomId: action.payload.roomId,
          startTime: new Date().toISOString(),
          participants: action.payload.participants || [],
        },
      };

    case ActionTypes.END_SESSION:
      return {
        ...state,
        session: {
          ...initialState.session,
        },
      };

    case ActionTypes.UPDATE_SESSION:
      return {
        ...state,
        session: { ...state.session, ...action.payload },
      };

    case ActionTypes.ADD_PARTICIPANT:
      return {
        ...state,
        session: {
          ...state.session,
          participants: [...state.session.participants, action.payload],
        },
      };

    case ActionTypes.REMOVE_PARTICIPANT:
      return {
        ...state,
        session: {
          ...state.session,
          participants: state.session.participants.filter(
            p => p.id !== action.payload
          ),
        },
      };

    case ActionTypes.UPDATE_AUDIO_SETTINGS:
      return {
        ...state,
        settings: {
          ...state.settings,
          audio: { ...state.settings.audio, ...action.payload },
        },
      };

    case ActionTypes.UPDATE_TRANSLATION_SETTINGS:
      return {
        ...state,
        settings: {
          ...state.settings,
          translation: { ...state.settings.translation, ...action.payload },
        },
      };

    case ActionTypes.UPDATE_NETWORK_SETTINGS:
      return {
        ...state,
        settings: {
          ...state.settings,
          network: { ...state.settings.network, ...action.payload },
        },
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        ui: { ...state.ui, loading: action.payload },
      };

    case ActionTypes.SET_ERROR:
      return {
        ...state,
        ui: { ...state.ui, error: action.payload },
      };

    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        ui: { ...state.ui, error: null },
      };

    case ActionTypes.ADD_NOTIFICATION:
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [...state.ui.notifications, action.payload],
        },
      };

    case ActionTypes.REMOVE_NOTIFICATION:
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(
            n => n.id !== action.payload
          ),
        },
      };

    case ActionTypes.TOGGLE_MODAL:
      return {
        ...state,
        ui: {
          ...state.ui,
          modals: {
            ...state.ui.modals,
            [action.payload.modal]: action.payload.visible,
          },
        },
      };

    default:
      return state;
  }
};

// Context
const EchoContext = createContext();

// Provider Component
export const EchoProvider = ({ children }) => {
  const [state, dispatch] = useReducer(echoReducer, initialState);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  // Persist state changes
  useEffect(() => {
    persistState();
  }, [state.user, state.app, state.settings]);

  const loadPersistedState = async () => {
    try {
      const persistedUser = await AsyncStorage.getItem('echo_user');
      const persistedApp = await AsyncStorage.getItem('echo_app');
      const persistedSettings = await AsyncStorage.getItem('echo_settings');

      if (persistedUser) {
        dispatch({
          type: ActionTypes.SET_USER,
          payload: JSON.parse(persistedUser),
        });
      }

      if (persistedApp) {
        const appData = JSON.parse(persistedApp);
        dispatch({
          type: ActionTypes.SET_ONBOARDED,
          payload: appData.isOnboarded,
        });
      }

      if (persistedSettings) {
        const settings = JSON.parse(persistedSettings);
        if (settings.audio) {
          dispatch({
            type: ActionTypes.UPDATE_AUDIO_SETTINGS,
            payload: settings.audio,
          });
        }
        if (settings.translation) {
          dispatch({
            type: ActionTypes.UPDATE_TRANSLATION_SETTINGS,
            payload: settings.translation,
          });
        }
        if (settings.network) {
          dispatch({
            type: ActionTypes.UPDATE_NETWORK_SETTINGS,
            payload: settings.network,
          });
        }
      }

      Logger.info('EchoProvider', 'Persisted state loaded successfully');
    } catch (error) {
      Logger.error('EchoProvider', 'Failed to load persisted state:', error);
    }
  };

  const persistState = async () => {
    try {
      await AsyncStorage.setItem('echo_user', JSON.stringify(state.user));
      await AsyncStorage.setItem('echo_app', JSON.stringify(state.app));
      await AsyncStorage.setItem('echo_settings', JSON.stringify(state.settings));
    } catch (error) {
      Logger.error('EchoProvider', 'Failed to persist state:', error);
    }
  };

  // Action Creators
  const actions = {
    // User Actions
    setUser: (user) => dispatch({ type: ActionTypes.SET_USER, payload: user }),
    updateUserPreferences: (preferences) => dispatch({
      type: ActionTypes.UPDATE_USER_PREFERENCES,
      payload: preferences,
    }),

    // App Actions
    setInitialized: (initialized) => dispatch({
      type: ActionTypes.SET_INITIALIZED,
      payload: initialized,
    }),
    setOnboarded: (onboarded) => dispatch({
      type: ActionTypes.SET_ONBOARDED,
      payload: onboarded,
    }),

    // Session Actions
    startSession: (sessionData) => dispatch({
      type: ActionTypes.START_SESSION,
      payload: sessionData,
    }),
    endSession: () => dispatch({ type: ActionTypes.END_SESSION }),
    updateSession: (sessionData) => dispatch({
      type: ActionTypes.UPDATE_SESSION,
      payload: sessionData,
    }),
    addParticipant: (participant) => dispatch({
      type: ActionTypes.ADD_PARTICIPANT,
      payload: participant,
    }),
    removeParticipant: (participantId) => dispatch({
      type: ActionTypes.REMOVE_PARTICIPANT,
      payload: participantId,
    }),

    // Settings Actions
    updateAudioSettings: (settings) => dispatch({
      type: ActionTypes.UPDATE_AUDIO_SETTINGS,
      payload: settings,
    }),
    updateTranslationSettings: (settings) => dispatch({
      type: ActionTypes.UPDATE_TRANSLATION_SETTINGS,
      payload: settings,
    }),
    updateNetworkSettings: (settings) => dispatch({
      type: ActionTypes.UPDATE_NETWORK_SETTINGS,
      payload: settings,
    }),

    // UI Actions
    setLoading: (loading) => dispatch({
      type: ActionTypes.SET_LOADING,
      payload: loading,
    }),
    setError: (error) => dispatch({ type: ActionTypes.SET_ERROR, payload: error }),
    clearError: () => dispatch({ type: ActionTypes.CLEAR_ERROR }),
    addNotification: (notification) => dispatch({
      type: ActionTypes.ADD_NOTIFICATION,
      payload: { ...notification, id: Date.now() },
    }),
    removeNotification: (id) => dispatch({
      type: ActionTypes.REMOVE_NOTIFICATION,
      payload: id,
    }),
    toggleModal: (modal, visible) => dispatch({
      type: ActionTypes.TOGGLE_MODAL,
      payload: { modal, visible },
    }),
  };

  const value = {
    state,
    actions,
    dispatch,
  };

  return React.createElement(EchoContext.Provider, { value }, children);
};

// Hook
export const useEcho = () => {
  const context = useContext(EchoContext);
  if (!context) {
    throw new Error('useEcho must be used within an EchoProvider');
  }
  return context;
};

export default EchoProvider;