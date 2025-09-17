import React, { useState, useEffect } from 'react';
import { useEchoRTC } from './EchoRTCProvider.jsx';
import './ConnectionStatus.css';

/**
 * Connection Status Component
 * Displays real-time connection status and statistics
 */
const ConnectionStatus = ({
  isConnected = false,
  participants = 0,
  showDetails = false,
  showReconnectButton = true,
  className = '',
  style = {},
}) => {
  const { connectionError, isConnecting, roomId, qualityMetrics, echoRTC } = useEchoRTC();

  // Local state
  const [connectionDuration, setConnectionDuration] = useState(0);
  const [connectionStartTime, setConnectionStartTime] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  /**
   * Get connection status
   */
  const getConnectionStatus = () => {
    if (connectionError) {
      return {
        status: 'error',
        color: '#F44336',
        text: 'Connection Error',
        icon: '🚨',
      };
    }

    if (isConnecting || isReconnecting) {
      return {
        status: 'connecting',
        color: '#FF9800',
        text: isReconnecting ? 'Reconnecting...' : 'Connecting...',
        icon: '🔄',
      };
    }

    if (isConnected) {
      const quality = qualityMetrics?.network?.rtt || 0;
      if (quality < 100) {
        return {
          status: 'excellent',
          color: '#4CAF50',
          text: 'Excellent Connection',
          icon: '🟢',
        };
      } else if (quality < 200) {
        return {
          status: 'good',
          color: '#8BC34A',
          text: 'Good Connection',
          icon: '🟡',
        };
      } else {
        return {
          status: 'poor',
          color: '#FF5722',
          text: 'Poor Connection',
          icon: '🟠',
        };
      }
    }

    return {
      status: 'disconnected',
      color: '#9E9E9E',
      text: 'Disconnected',
      icon: '🔴',
    };
  };

  /**
   * Format duration
   */
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Handle reconnect
   */
  const handleReconnect = async () => {
    if (!echoRTC || !roomId) return;

    setIsReconnecting(true);
    setReconnectAttempts((prev) => prev + 1);

    try {
      await echoRTC.reconnect();
      setReconnectAttempts(0);
    } catch (error) {
      console.error('Reconnection failed:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  /**
   * Get network type
   */
  const getNetworkType = () => {
    if (navigator.connection) {
      return navigator.connection.effectiveType || 'unknown';
    }
    return 'unknown';
  };

  /**
   * Get signal strength
   */
  const getSignalStrength = () => {
    const rtt = qualityMetrics?.network?.rtt || 0;
    if (rtt < 50) return { strength: 'excellent', bars: 4 };
    if (rtt < 100) return { strength: 'good', bars: 3 };
    if (rtt < 200) return { strength: 'fair', bars: 2 };
    if (rtt < 500) return { strength: 'poor', bars: 1 };
    return { strength: 'critical', bars: 0 };
  };

  // Update connection duration
  useEffect(() => {
    let interval;

    if (isConnected) {
      if (!connectionStartTime) {
        setConnectionStartTime(Date.now());
      }

      interval = setInterval(() => {
        if (connectionStartTime) {
          const duration = Math.floor((Date.now() - connectionStartTime) / 1000);
          setConnectionDuration(duration);
        }
      }, 1000);
    } else {
      setConnectionStartTime(null);
      setConnectionDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, connectionStartTime]);

  const connectionStatus = getConnectionStatus();
  const signalStrength = getSignalStrength();
  const networkType = getNetworkType();

  return (
    <div className={`connection-status ${className}`} style={style}>
      {/* Main Status Display */}
      <div
        className="connection-status__main"
        onClick={() => setShowDropdown(!showDropdown)}
        title={connectionStatus.text}
      >
        {/* Status Icon */}
        <div className="connection-status__icon">{connectionStatus.icon}</div>

        {/* Signal Strength */}
        <div className="connection-status__signal">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className={`connection-status__signal-bar ${
                index < signalStrength.bars ? 'connection-status__signal-bar--active' : ''
              }`}
              style={{
                backgroundColor: index < signalStrength.bars ? connectionStatus.color : '#E0E0E0',
              }}
            ></div>
          ))}
        </div>

        {/* Status Text */}
        <div className="connection-status__text">
          <span className="connection-status__status" style={{ color: connectionStatus.color }}>
            {connectionStatus.text}
          </span>

          {isConnected && (
            <span className="connection-status__participants">
              {participants} participant{participants !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Duration */}
        {isConnected && connectionDuration > 0 && (
          <div className="connection-status__duration">{formatDuration(connectionDuration)}</div>
        )}
      </div>

      {/* Detailed Status Dropdown */}
      {showDropdown && (
        <div className="connection-status__dropdown">
          {/* Connection Info */}
          <div className="connection-status__section">
            <h4>Connection Details</h4>

            <div className="connection-status__details">
              <div className="connection-status__detail">
                <span className="connection-status__detail-label">Status:</span>
                <span
                  className="connection-status__detail-value"
                  style={{ color: connectionStatus.color }}
                >
                  {connectionStatus.text}
                </span>
              </div>

              {roomId && (
                <div className="connection-status__detail">
                  <span className="connection-status__detail-label">Room ID:</span>
                  <span className="connection-status__detail-value">{roomId}</span>
                </div>
              )}

              <div className="connection-status__detail">
                <span className="connection-status__detail-label">Participants:</span>
                <span className="connection-status__detail-value">{participants}</span>
              </div>

              {isConnected && (
                <div className="connection-status__detail">
                  <span className="connection-status__detail-label">Duration:</span>
                  <span className="connection-status__detail-value">
                    {formatDuration(connectionDuration)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Network Info */}
          <div className="connection-status__section">
            <h4>Network Information</h4>

            <div className="connection-status__details">
              <div className="connection-status__detail">
                <span className="connection-status__detail-label">Type:</span>
                <span className="connection-status__detail-value">{networkType.toUpperCase()}</span>
              </div>

              <div className="connection-status__detail">
                <span className="connection-status__detail-label">RTT:</span>
                <span className="connection-status__detail-value">
                  {Math.round(qualityMetrics?.network?.rtt || 0)}ms
                </span>
              </div>

              <div className="connection-status__detail">
                <span className="connection-status__detail-label">Bandwidth:</span>
                <span className="connection-status__detail-value">
                  {qualityMetrics?.network?.bandwidth > 1000
                    ? `${(qualityMetrics.network.bandwidth / 1000).toFixed(1)}Mbps`
                    : `${Math.round(qualityMetrics?.network?.bandwidth || 0)}Kbps`}
                </span>
              </div>

              <div className="connection-status__detail">
                <span className="connection-status__detail-label">Packet Loss:</span>
                <span className="connection-status__detail-value">
                  {((qualityMetrics?.network?.packetLoss || 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div className="connection-status__detail">
                <span className="connection-status__detail-label">Jitter:</span>
                <span className="connection-status__detail-value">
                  {Math.round(qualityMetrics?.network?.jitter || 0)}ms
                </span>
              </div>
            </div>
          </div>

          {/* Error Information */}
          {connectionError && (
            <div className="connection-status__section">
              <h4>Connection Error</h4>
              <div className="connection-status__error">
                <span className="connection-status__error-icon">🚨</span>
                <span className="connection-status__error-message">{connectionError}</span>
              </div>

              {reconnectAttempts > 0 && (
                <div className="connection-status__reconnect-info">
                  <span>Reconnection attempts: {reconnectAttempts}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="connection-status__actions">
            {showReconnectButton && !isConnected && !isConnecting && (
              <button
                className="connection-status__action-button connection-status__reconnect-button"
                onClick={handleReconnect}
                disabled={isReconnecting}
              >
                {isReconnecting ? '🔄 Reconnecting...' : '🔄 Reconnect'}
              </button>
            )}

            <button
              className="connection-status__action-button"
              onClick={() => window.location.reload()}
              title="Refresh Page"
            >
              🔄 Refresh
            </button>

            <button
              className="connection-status__action-button"
              onClick={() => {
                navigator.clipboard.writeText(roomId || 'No room ID');
              }}
              title="Copy Room ID"
            >
              📋 Copy Room ID
            </button>
          </div>

          {/* Statistics */}
          <div className="connection-status__section">
            <h4>Session Statistics</h4>

            <div className="connection-status__stats">
              <div className="connection-status__stat">
                <span className="connection-status__stat-label">Uptime:</span>
                <span className="connection-status__stat-value">
                  {isConnected ? formatDuration(connectionDuration) : '0:00'}
                </span>
              </div>

              <div className="connection-status__stat">
                <span className="connection-status__stat-label">Reconnects:</span>
                <span className="connection-status__stat-value">{reconnectAttempts}</span>
              </div>

              <div className="connection-status__stat">
                <span className="connection-status__stat-label">Quality:</span>
                <span className="connection-status__stat-value">{signalStrength.strength}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
