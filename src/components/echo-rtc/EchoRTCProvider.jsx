import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { EchoRTC } from '../../services/echo-rtc/echo-rtc.js';
import { QualityMonitor } from '../../services/echo-rtc/quality-monitor.js';
import { EchoAIAgent } from '../../services/ai-agents/echo-ai-agent.js';

/**
 * Echo RTC Context for managing real-time communication state
 */
const EchoRTCContext = createContext(null);

/**
 * Hook to use Echo RTC context
 */
export const useEchoRTC = () => {
  const context = useContext(EchoRTCContext);
  if (!context) {
    throw new Error('useEchoRTC must be used within an EchoRTCProvider');
  }
  return context;
};

/**
 * Echo RTC Provider Component
 * Provides real-time communication capabilities to child components
 */
export const EchoRTCProvider = ({ children, config = {} }) => {
  // Core services
  const [echoRTC, setEchoRTC] = useState(null);
  const [qualityMonitor, setQualityMonitor] = useState(null);
  const [aiAgent, setAIAgent] = useState(null);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Audio state
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioDevices, setAudioDevices] = useState({ input: [], output: [] });
  const [selectedDevices, setSelectedDevices] = useState({ input: null, output: null });

  // Translation state
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [translationHistory, setTranslationHistory] = useState([]);

  // Quality metrics
  const [qualityMetrics, setQualityMetrics] = useState({
    audio: { quality: 0, latency: 0, packetLoss: 0 },
    network: { bandwidth: 0, rtt: 0, jitter: 0 },
    translation: { accuracy: 0, speed: 0, confidence: 0 },
  });

  // Participants
  const [participants, setParticipants] = useState([]);
  const [localParticipant, setLocalParticipant] = useState(null);

  // Room state
  const [roomId, setRoomId] = useState(null);
  const [roomMetadata, setRoomMetadata] = useState({});

  // Default configuration
  const defaultConfig = {
    rtc: {
      name: 'EchoRTCWebComponent',
      version: '1.0.0',
      enableAudio: true,
      enableTranslation: true,
      enableQualityMonitoring: true,
      enableAIAgent: true,
      autoConnect: false,
      reconnectAttempts: 3,
      reconnectDelay: 2000,
    },
    audio: {
      sampleRate: 48000,
      channels: 1,
      bitrate: 128000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    translation: {
      provider: 'deepl',
      realTimeTranslation: true,
      confidenceThreshold: 0.8,
      maxRetries: 3,
    },
    quality: {
      monitoringInterval: 1000,
      alertThresholds: {
        audioQuality: 0.7,
        networkLatency: 200,
        packetLoss: 0.05,
      },
    },
    ai: {
      enableContextAwareness: true,
      enableLearning: true,
      responseTimeout: 5000,
    },
  };

  const mergedConfig = { ...defaultConfig, ...config };

  /**
   * Initialize Echo RTC services
   */
  const initializeServices = useCallback(async () => {
    try {
      // Initialize Echo RTC
      const rtcInstance = new EchoRTC(mergedConfig);
      await rtcInstance.initialize();
      setEchoRTC(rtcInstance);

      // Initialize Quality Monitor
      if (mergedConfig.rtc.enableQualityMonitoring) {
        const qualityInstance = new QualityMonitor(mergedConfig.quality);
        await qualityInstance.initialize();
        setQualityMonitor(qualityInstance);
      }

      // Initialize AI Agent
      if (mergedConfig.rtc.enableAIAgent) {
        const aiInstance = new EchoAIAgent(mergedConfig.ai);
        await aiInstance.initialize();
        setAIAgent(aiInstance);
      }

      // Setup event listeners
      setupEventListeners(rtcInstance, qualityInstance, aiInstance);
    } catch (error) {
      console.error('Failed to initialize Echo RTC services:', error);
      setConnectionError(error.message);
    }
  }, [mergedConfig]);

  /**
   * Setup event listeners for all services
   */
  const setupEventListeners = useCallback((rtc, quality, ai) => {
    if (rtc) {
      // Connection events
      rtc.on('connected', () => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
      });

      rtc.on('disconnected', () => {
        setIsConnected(false);
        setIsConnecting(false);
      });

      rtc.on('connection-error', (error) => {
        setConnectionError(error.message);
        setIsConnecting(false);
      });

      // Participant events
      rtc.on('participant-joined', (participant) => {
        setParticipants((prev) => [...prev, participant]);
      });

      rtc.on('participant-left', (participantId) => {
        setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      });

      // Audio events
      rtc.on('audio-level', (level) => {
        setAudioLevel(level);
      });

      rtc.on('audio-devices-changed', (devices) => {
        setAudioDevices(devices);
      });

      // Translation events
      rtc.on('translation-received', (translation) => {
        setTranslationHistory((prev) => [...prev, translation]);
      });
    }

    if (quality) {
      // Quality monitoring events
      quality.on('metrics-updated', (metrics) => {
        setQualityMetrics(metrics);
      });

      quality.on('quality-alert', (alert) => {
        console.warn('Quality alert:', alert);
      });
    }

    if (ai) {
      // AI agent events
      ai.on('response-generated', (response) => {
        console.log('AI response:', response);
      });

      ai.on('context-updated', (context) => {
        console.log('AI context updated:', context);
      });
    }
  }, []);

  /**
   * Connect to a room
   */
  const connectToRoom = useCallback(
    async (roomId, options = {}) => {
      if (!echoRTC) {
        throw new Error('Echo RTC not initialized');
      }

      setIsConnecting(true);
      setConnectionError(null);

      try {
        const connectionResult = await echoRTC.connect(roomId, options);
        setRoomId(roomId);
        setRoomMetadata(connectionResult.metadata || {});
        setLocalParticipant(connectionResult.localParticipant);

        // Start quality monitoring
        if (qualityMonitor) {
          await qualityMonitor.start();
        }

        // Start AI agent
        if (aiAgent) {
          await aiAgent.start();
        }

        return connectionResult;
      } catch (error) {
        setConnectionError(error.message);
        setIsConnecting(false);
        throw error;
      }
    },
    [echoRTC, qualityMonitor, aiAgent]
  );

  /**
   * Disconnect from room
   */
  const disconnectFromRoom = useCallback(async () => {
    if (!echoRTC) return;

    try {
      await echoRTC.disconnect();

      // Stop quality monitoring
      if (qualityMonitor) {
        await qualityMonitor.stop();
      }

      // Stop AI agent
      if (aiAgent) {
        await aiAgent.stop();
      }

      // Reset state
      setRoomId(null);
      setRoomMetadata({});
      setParticipants([]);
      setLocalParticipant(null);
      setTranslationHistory([]);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }, [echoRTC, qualityMonitor, aiAgent]);

  /**
   * Enable/disable audio
   */
  const toggleAudio = useCallback(
    async (enabled) => {
      if (!echoRTC) return;

      try {
        if (enabled) {
          await echoRTC.enableAudio();
        } else {
          await echoRTC.disableAudio();
        }
        setIsAudioEnabled(enabled);
      } catch (error) {
        console.error('Error toggling audio:', error);
      }
    },
    [echoRTC]
  );

  /**
   * Mute/unmute audio
   */
  const toggleMute = useCallback(
    async (muted) => {
      if (!echoRTC) return;

      try {
        if (muted) {
          await echoRTC.muteAudio();
        } else {
          await echoRTC.unmuteAudio();
        }
        setIsMuted(muted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
    },
    [echoRTC]
  );

  /**
   * Change audio device
   */
  const changeAudioDevice = useCallback(
    async (deviceType, deviceId) => {
      if (!echoRTC) return;

      try {
        await echoRTC.changeAudioDevice(deviceType, deviceId);
        setSelectedDevices((prev) => ({
          ...prev,
          [deviceType]: deviceId,
        }));
      } catch (error) {
        console.error('Error changing audio device:', error);
      }
    },
    [echoRTC]
  );

  /**
   * Enable/disable translation
   */
  const toggleTranslation = useCallback(
    async (enabled) => {
      if (!echoRTC) return;

      try {
        if (enabled) {
          await echoRTC.enableTranslation({
            sourceLanguage,
            targetLanguage,
          });
        } else {
          await echoRTC.disableTranslation();
        }
        setIsTranslationEnabled(enabled);
      } catch (error) {
        console.error('Error toggling translation:', error);
      }
    },
    [echoRTC, sourceLanguage, targetLanguage]
  );

  /**
   * Change translation languages
   */
  const changeTranslationLanguages = useCallback(
    async (source, target) => {
      setSourceLanguage(source);
      setTargetLanguage(target);

      if (echoRTC && isTranslationEnabled) {
        try {
          await echoRTC.updateTranslationLanguages(source, target);
        } catch (error) {
          console.error('Error updating translation languages:', error);
        }
      }
    },
    [echoRTC, isTranslationEnabled]
  );

  /**
   * Send message with optional translation
   */
  const sendMessage = useCallback(
    async (message, options = {}) => {
      if (!echoRTC) return;

      try {
        const result = await echoRTC.sendMessage(message, {
          translate: isTranslationEnabled,
          sourceLanguage,
          targetLanguage,
          ...options,
        });

        if (result.translation) {
          setTranslationHistory((prev) => [...prev, result.translation]);
        }

        return result;
      } catch (error) {
        console.error('Error sending message:', error);
        throw error;
      }
    },
    [echoRTC, isTranslationEnabled, sourceLanguage, targetLanguage]
  );

  /**
   * Get room statistics
   */
  const getRoomStatistics = useCallback(() => {
    if (!echoRTC) return null;

    return {
      participants: participants.length,
      connectionDuration: echoRTC.getConnectionDuration(),
      audioQuality: qualityMetrics.audio.quality,
      networkLatency: qualityMetrics.network.rtt,
      translationsCount: translationHistory.length,
    };
  }, [echoRTC, participants, qualityMetrics, translationHistory]);

  // Initialize services on mount
  useEffect(() => {
    initializeServices();

    return () => {
      // Cleanup on unmount
      if (echoRTC) {
        echoRTC.cleanup();
      }
      if (qualityMonitor) {
        qualityMonitor.cleanup();
      }
      if (aiAgent) {
        aiAgent.cleanup();
      }
    };
  }, [initializeServices]);

  // Auto-connect if enabled
  useEffect(() => {
    if (echoRTC && mergedConfig.rtc.autoConnect && !isConnected && !isConnecting) {
      const autoRoomId = mergedConfig.rtc.autoRoomId || 'default-room';
      connectToRoom(autoRoomId).catch(console.error);
    }
  }, [echoRTC, mergedConfig.rtc.autoConnect, isConnected, isConnecting, connectToRoom]);

  // Context value
  const contextValue = {
    // Services
    echoRTC,
    qualityMonitor,
    aiAgent,

    // Connection state
    isConnected,
    isConnecting,
    connectionError,

    // Audio state
    isAudioEnabled,
    isMuted,
    audioLevel,
    audioDevices,
    selectedDevices,

    // Translation state
    isTranslationEnabled,
    sourceLanguage,
    targetLanguage,
    translationHistory,

    // Quality metrics
    qualityMetrics,

    // Participants
    participants,
    localParticipant,

    // Room state
    roomId,
    roomMetadata,

    // Actions
    connectToRoom,
    disconnectFromRoom,
    toggleAudio,
    toggleMute,
    changeAudioDevice,
    toggleTranslation,
    changeTranslationLanguages,
    sendMessage,
    getRoomStatistics,
  };

  return <EchoRTCContext.Provider value={contextValue}>{children}</EchoRTCContext.Provider>;
};

export default EchoRTCProvider;
