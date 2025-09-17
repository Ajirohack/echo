import React, { useState, useEffect } from 'react';
import './QualityIndicator.css';

/**
 * Quality Indicator Component
 * Displays real-time quality metrics for audio, network, and translation
 */
const QualityIndicator = ({
  metrics = {},
  showDetails = false,
  showHistory = false,
  updateInterval = 1000,
  className = '',
  style = {},
}) => {
  // Local state
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('overall');
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Default metrics structure
  const defaultMetrics = {
    audio: {
      quality: 0,
      latency: 0,
      packetLoss: 0,
      jitter: 0,
      bitrate: 0,
    },
    network: {
      bandwidth: 0,
      rtt: 0,
      jitter: 0,
      packetLoss: 0,
      connectionType: 'unknown',
    },
    translation: {
      accuracy: 0,
      speed: 0,
      confidence: 0,
      latency: 0,
    },
  };

  const currentMetrics = { ...defaultMetrics, ...metrics };

  /**
   * Calculate overall quality score
   */
  const calculateOverallQuality = () => {
    const audioWeight = 0.4;
    const networkWeight = 0.4;
    const translationWeight = 0.2;

    const audioScore = currentMetrics.audio.quality || 0;
    const networkScore = Math.max(0, 1 - currentMetrics.network.rtt / 500); // 500ms as max acceptable RTT
    const translationScore = currentMetrics.translation.accuracy || 0;

    return (
      audioScore * audioWeight + networkScore * networkWeight + translationScore * translationWeight
    );
  };

  /**
   * Get quality status
   */
  const getQualityStatus = (score) => {
    if (score >= 0.8)
      return { level: 'excellent', color: '#4CAF50', text: 'Excellent', icon: '🟢' };
    if (score >= 0.6) return { level: 'good', color: '#8BC34A', text: 'Good', icon: '🟡' };
    if (score >= 0.4) return { level: 'fair', color: '#FF9800', text: 'Fair', icon: '🟠' };
    if (score >= 0.2) return { level: 'poor', color: '#FF5722', text: 'Poor', icon: '🔴' };
    return { level: 'critical', color: '#F44336', text: 'Critical', icon: '🚨' };
  };

  /**
   * Get metric color based on value and thresholds
   */
  const getMetricColor = (value, thresholds) => {
    if (value >= thresholds.excellent) return '#4CAF50';
    if (value >= thresholds.good) return '#8BC34A';
    if (value >= thresholds.fair) return '#FF9800';
    return '#F44336';
  };

  /**
   * Format metric value
   */
  const formatMetricValue = (value, type) => {
    switch (type) {
      case 'percentage':
        return `${Math.round(value * 100)}%`;
      case 'latency':
        return `${Math.round(value)}ms`;
      case 'bandwidth':
        return value > 1000 ? `${(value / 1000).toFixed(1)}Mbps` : `${Math.round(value)}Kbps`;
      case 'packetLoss':
        return `${(value * 100).toFixed(1)}%`;
      default:
        return Math.round(value);
    }
  };

  /**
   * Check for quality alerts
   */
  const checkAlerts = () => {
    const newAlerts = [];

    // Audio alerts
    if (currentMetrics.audio.quality < 0.5) {
      newAlerts.push({
        type: 'audio',
        level: 'warning',
        message: 'Poor audio quality detected',
        timestamp: Date.now(),
      });
    }

    if (currentMetrics.audio.latency > 200) {
      newAlerts.push({
        type: 'audio',
        level: 'warning',
        message: 'High audio latency detected',
        timestamp: Date.now(),
      });
    }

    // Network alerts
    if (currentMetrics.network.rtt > 300) {
      newAlerts.push({
        type: 'network',
        level: 'warning',
        message: 'High network latency detected',
        timestamp: Date.now(),
      });
    }

    if (currentMetrics.network.packetLoss > 0.05) {
      newAlerts.push({
        type: 'network',
        level: 'error',
        message: 'High packet loss detected',
        timestamp: Date.now(),
      });
    }

    // Translation alerts
    if (currentMetrics.translation.accuracy < 0.7) {
      newAlerts.push({
        type: 'translation',
        level: 'warning',
        message: 'Low translation accuracy',
        timestamp: Date.now(),
      });
    }

    setAlerts(newAlerts);
  };

  /**
   * Update metrics history
   */
  const updateHistory = () => {
    if (showHistory) {
      setMetricsHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            timestamp: Date.now(),
            overall: calculateOverallQuality(),
            ...currentMetrics,
          },
        ];

        // Keep only last 60 data points (1 minute at 1s intervals)
        return newHistory.slice(-60);
      });
    }
  };

  // Update history and check alerts
  useEffect(() => {
    updateHistory();
    checkAlerts();
  }, [metrics]);

  const overallQuality = calculateOverallQuality();
  const qualityStatus = getQualityStatus(overallQuality);

  return (
    <div className={`quality-indicator ${className}`} style={style}>
      {/* Main Quality Display */}
      <div
        className="quality-indicator__main"
        onClick={() => setShowDropdown(!showDropdown)}
        title={`Overall Quality: ${qualityStatus.text}`}
      >
        <div className="quality-indicator__icon">{qualityStatus.icon}</div>

        <div className="quality-indicator__score">
          <div
            className="quality-indicator__bar"
            style={{
              width: `${overallQuality * 100}%`,
              backgroundColor: qualityStatus.color,
            }}
          ></div>
          <span className="quality-indicator__percentage">{Math.round(overallQuality * 100)}%</span>
        </div>

        {alerts.length > 0 && (
          <div className="quality-indicator__alerts-badge">{alerts.length}</div>
        )}
      </div>

      {/* Detailed Metrics Dropdown */}
      {showDropdown && (
        <div className="quality-indicator__dropdown">
          {/* Metric Selector */}
          <div className="quality-indicator__selector">
            <button
              className={`quality-indicator__tab ${
                selectedMetric === 'overall' ? 'quality-indicator__tab--active' : ''
              }`}
              onClick={() => setSelectedMetric('overall')}
            >
              Overall
            </button>

            <button
              className={`quality-indicator__tab ${
                selectedMetric === 'audio' ? 'quality-indicator__tab--active' : ''
              }`}
              onClick={() => setSelectedMetric('audio')}
            >
              Audio
            </button>

            <button
              className={`quality-indicator__tab ${
                selectedMetric === 'network' ? 'quality-indicator__tab--active' : ''
              }`}
              onClick={() => setSelectedMetric('network')}
            >
              Network
            </button>

            <button
              className={`quality-indicator__tab ${
                selectedMetric === 'translation' ? 'quality-indicator__tab--active' : ''
              }`}
              onClick={() => setSelectedMetric('translation')}
            >
              Translation
            </button>
          </div>

          {/* Metric Details */}
          <div className="quality-indicator__details">
            {selectedMetric === 'overall' && (
              <div className="quality-indicator__section">
                <h4>Overall Quality</h4>
                <div className="quality-indicator__metrics">
                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Status:</span>
                    <span
                      className="quality-indicator__metric-value"
                      style={{ color: qualityStatus.color }}
                    >
                      {qualityStatus.text}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Score:</span>
                    <span className="quality-indicator__metric-value">
                      {Math.round(overallQuality * 100)}/100
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Active Alerts:</span>
                    <span className="quality-indicator__metric-value">{alerts.length}</span>
                  </div>
                </div>
              </div>
            )}

            {selectedMetric === 'audio' && (
              <div className="quality-indicator__section">
                <h4>Audio Quality</h4>
                <div className="quality-indicator__metrics">
                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Quality:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.audio.quality, 'percentage')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Latency:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.audio.latency, 'latency')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Packet Loss:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.audio.packetLoss, 'packetLoss')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Jitter:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.audio.jitter, 'latency')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Bitrate:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.audio.bitrate, 'bandwidth')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedMetric === 'network' && (
              <div className="quality-indicator__section">
                <h4>Network Quality</h4>
                <div className="quality-indicator__metrics">
                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">RTT:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.network.rtt, 'latency')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Bandwidth:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.network.bandwidth, 'bandwidth')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Packet Loss:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.network.packetLoss, 'packetLoss')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Jitter:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.network.jitter, 'latency')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Connection:</span>
                    <span className="quality-indicator__metric-value">
                      {currentMetrics.network.connectionType}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedMetric === 'translation' && (
              <div className="quality-indicator__section">
                <h4>Translation Quality</h4>
                <div className="quality-indicator__metrics">
                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Accuracy:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.translation.accuracy, 'percentage')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Speed:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.translation.speed, 'percentage')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Confidence:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.translation.confidence, 'percentage')}
                    </span>
                  </div>

                  <div className="quality-indicator__metric">
                    <span className="quality-indicator__metric-label">Latency:</span>
                    <span className="quality-indicator__metric-value">
                      {formatMetricValue(currentMetrics.translation.latency, 'latency')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="quality-indicator__alerts">
              <h4>Active Alerts</h4>
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`quality-indicator__alert quality-indicator__alert--${alert.level}`}
                >
                  <span className="quality-indicator__alert-icon">
                    {alert.level === 'error' ? '🚨' : '⚠️'}
                  </span>
                  <span className="quality-indicator__alert-message">{alert.message}</span>
                  <span className="quality-indicator__alert-type">{alert.type}</span>
                </div>
              ))}
            </div>
          )}

          {/* History Chart (if enabled) */}
          {showHistory && metricsHistory.length > 0 && (
            <div className="quality-indicator__history">
              <h4>Quality History</h4>
              <div className="quality-indicator__chart">
                {metricsHistory.map((point, index) => (
                  <div
                    key={index}
                    className="quality-indicator__chart-bar"
                    style={{
                      height: `${point.overall * 100}%`,
                      backgroundColor: getQualityStatus(point.overall).color,
                    }}
                    title={`${Math.round(point.overall * 100)}% at ${new Date(point.timestamp).toLocaleTimeString()}`}
                  ></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QualityIndicator;
