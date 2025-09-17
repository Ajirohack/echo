import React, { useState, useEffect, useRef } from 'react';
import { useEchoRTC } from './EchoRTCProvider.jsx';
import AudioControls from './AudioControls.jsx';
import TranslationPanel from './TranslationPanel.jsx';
import ParticipantsList from './ParticipantsList.jsx';
import QualityIndicator from './QualityIndicator.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import MessageInput from './MessageInput.jsx';
import './EchoRTCRoom.css';

/**
 * Main Echo RTC Room Component
 * Provides complete real-time communication interface
 */
const EchoRTCRoom = ({
  roomId,
  autoConnect = true,
  showParticipants = true,
  showTranslation = true,
  showQuality = true,
  showMessages = true,
  className = '',
  style = {},
  onRoomJoined,
  onRoomLeft,
  onParticipantJoined,
  onParticipantLeft,
  onTranslationReceived,
  onError,
}) => {
  const {
    isConnected,
    isConnecting,
    connectionError,
    participants,
    localParticipant,
    translationHistory,
    qualityMetrics,
    connectToRoom,
    disconnectFromRoom,
    sendMessage,
  } = useEchoRTC();

  // Local state
  const [isJoining, setIsJoining] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layout, setLayout] = useState('default'); // default, compact, minimal

  // Refs
  const roomRef = useRef(null);
  const messagesEndRef = useRef(null);

  /**
   * Join room
   */
  const handleJoinRoom = async () => {
    if (!roomId || isConnected || isConnecting) return;

    setIsJoining(true);

    try {
      const result = await connectToRoom(roomId, {
        audio: true,
        translation: showTranslation,
      });

      if (onRoomJoined) {
        onRoomJoined(result);
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsJoining(false);
    }
  };

  /**
   * Leave room
   */
  const handleLeaveRoom = async () => {
    if (!isConnected) return;

    try {
      await disconnectFromRoom();
      setMessages([]);

      if (onRoomLeft) {
        onRoomLeft();
      }
    } catch (error) {
      console.error('Failed to leave room:', error);
      if (onError) {
        onError(error);
      }
    }
  };

  /**
   * Send message
   */
  const handleSendMessage = async (message, options = {}) => {
    try {
      const result = await sendMessage(message, options);

      // Add message to local messages
      const messageData = {
        id: Date.now(),
        text: message,
        sender: localParticipant?.name || 'You',
        timestamp: new Date(),
        translation: result.translation,
        ...options,
      };

      setMessages((prev) => [...prev, messageData]);

      return result;
    } catch (error) {
      console.error('Failed to send message:', error);
      if (onError) {
        onError(error);
      }
    }
  };

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      roomRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  /**
   * Change layout
   */
  const changeLayout = (newLayout) => {
    setLayout(newLayout);
  };

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && roomId && !isConnected && !isConnecting) {
      handleJoinRoom();
    }
  }, [autoConnect, roomId, isConnected, isConnecting]);

  // Handle participant events
  useEffect(() => {
    if (onParticipantJoined && participants.length > 0) {
      const latestParticipant = participants[participants.length - 1];
      onParticipantJoined(latestParticipant);
    }
  }, [participants, onParticipantJoined]);

  // Handle translation events
  useEffect(() => {
    if (onTranslationReceived && translationHistory.length > 0) {
      const latestTranslation = translationHistory[translationHistory.length - 1];
      onTranslationReceived(latestTranslation);
    }
  }, [translationHistory, onTranslationReceived]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle connection errors
  useEffect(() => {
    if (connectionError && onError) {
      onError(new Error(connectionError));
    }
  }, [connectionError, onError]);

  // Render connection screen
  if (!isConnected && !isConnecting && !isJoining) {
    return (
      <div className={`echo-rtc-room echo-rtc-room--disconnected ${className}`} style={style}>
        <div className="echo-rtc-room__connection-screen">
          <div className="echo-rtc-room__connection-content">
            <h2>Join Echo RTC Room</h2>
            <p>
              Room ID: <strong>{roomId}</strong>
            </p>

            {connectionError && (
              <div className="echo-rtc-room__error">
                <span className="echo-rtc-room__error-icon">⚠️</span>
                <span>{connectionError}</span>
              </div>
            )}

            <button
              className="echo-rtc-room__join-button"
              onClick={handleJoinRoom}
              disabled={!roomId}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render connecting screen
  if (isConnecting || isJoining) {
    return (
      <div className={`echo-rtc-room echo-rtc-room--connecting ${className}`} style={style}>
        <div className="echo-rtc-room__connection-screen">
          <div className="echo-rtc-room__connection-content">
            <div className="echo-rtc-room__spinner"></div>
            <h2>Connecting to Room...</h2>
            <p>Please wait while we establish the connection.</p>
          </div>
        </div>
      </div>
    );
  }

  // Render main room interface
  return (
    <div
      ref={roomRef}
      className={`echo-rtc-room echo-rtc-room--connected echo-rtc-room--${layout} ${isFullscreen ? 'echo-rtc-room--fullscreen' : ''} ${className}`}
      style={style}
    >
      {/* Header */}
      <div className="echo-rtc-room__header">
        <div className="echo-rtc-room__header-left">
          <h3 className="echo-rtc-room__title">Echo RTC Room</h3>
          <span className="echo-rtc-room__room-id">{roomId}</span>
        </div>

        <div className="echo-rtc-room__header-center">
          {showQuality && <QualityIndicator metrics={qualityMetrics} />}
          <ConnectionStatus isConnected={isConnected} participants={participants.length} />
        </div>

        <div className="echo-rtc-room__header-right">
          <button
            className="echo-rtc-room__layout-button"
            onClick={() => changeLayout(layout === 'default' ? 'compact' : 'default')}
            title="Change Layout"
          >
            📱
          </button>

          <button
            className="echo-rtc-room__fullscreen-button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? '🗗' : '🗖'}
          </button>

          <button
            className="echo-rtc-room__settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            ⚙️
          </button>

          <button
            className="echo-rtc-room__leave-button"
            onClick={handleLeaveRoom}
            title="Leave Room"
          >
            🚪
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="echo-rtc-room__settings">
          <div className="echo-rtc-room__settings-content">
            <h4>Room Settings</h4>

            <div className="echo-rtc-room__settings-group">
              <label>
                <input
                  type="checkbox"
                  checked={showParticipants}
                  onChange={(e) => setShowParticipants(e.target.checked)}
                />
                Show Participants
              </label>
            </div>

            <div className="echo-rtc-room__settings-group">
              <label>
                <input
                  type="checkbox"
                  checked={showTranslation}
                  onChange={(e) => setShowTranslation(e.target.checked)}
                />
                Show Translation
              </label>
            </div>

            <div className="echo-rtc-room__settings-group">
              <label>
                <input
                  type="checkbox"
                  checked={showQuality}
                  onChange={(e) => setShowQuality(e.target.checked)}
                />
                Show Quality Metrics
              </label>
            </div>

            <div className="echo-rtc-room__settings-group">
              <label>Layout:</label>
              <select value={layout} onChange={(e) => changeLayout(e.target.value)}>
                <option value="default">Default</option>
                <option value="compact">Compact</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="echo-rtc-room__content">
        {/* Left Panel - Participants */}
        {showParticipants && (
          <div className="echo-rtc-room__participants-panel">
            <ParticipantsList participants={participants} localParticipant={localParticipant} />
          </div>
        )}

        {/* Center Panel - Main Communication */}
        <div className="echo-rtc-room__main-panel">
          {/* Audio Controls */}
          <div className="echo-rtc-room__audio-section">
            <AudioControls />
          </div>

          {/* Messages */}
          {showMessages && (
            <div className="echo-rtc-room__messages-section">
              <div className="echo-rtc-room__messages">
                {messages.map((message) => (
                  <div key={message.id} className="echo-rtc-room__message">
                    <div className="echo-rtc-room__message-header">
                      <span className="echo-rtc-room__message-sender">{message.sender}</span>
                      <span className="echo-rtc-room__message-time">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="echo-rtc-room__message-content">
                      <p className="echo-rtc-room__message-text">{message.text}</p>
                      {message.translation && (
                        <p className="echo-rtc-room__message-translation">
                          🌐 {message.translation.text}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <MessageInput onSendMessage={handleSendMessage} />
            </div>
          )}
        </div>

        {/* Right Panel - Translation */}
        {showTranslation && (
          <div className="echo-rtc-room__translation-panel">
            <TranslationPanel
              translationHistory={translationHistory}
              onLanguageChange={(source, target) => {
                // Handle language change
                console.log('Language changed:', source, target);
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="echo-rtc-room__footer">
        <div className="echo-rtc-room__footer-stats">
          <span>Participants: {participants.length + 1}</span>
          <span>Messages: {messages.length}</span>
          <span>Translations: {translationHistory.length}</span>
        </div>
      </div>
    </div>
  );
};

export default EchoRTCRoom;
