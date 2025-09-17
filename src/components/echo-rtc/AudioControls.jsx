import React, { useState, useEffect, useRef } from 'react';
import { useEchoRTC } from './EchoRTCProvider.jsx';
import './AudioControls.css';

/**
 * Audio Controls Component
 * Provides comprehensive audio management interface
 */
const AudioControls = ({
  showDeviceSelector = true,
  showVolumeControl = true,
  showAudioLevel = true,
  showAdvancedControls = false,
  className = '',
  style = {},
}) => {
  const {
    isAudioEnabled,
    isMuted,
    audioLevel,
    audioDevices,
    selectedDevices,
    qualityMetrics,
    toggleAudio,
    toggleMute,
    changeAudioDevice,
  } = useEchoRTC();

  // Local state
  const [volume, setVolume] = useState(1.0);
  const [showDevices, setShowDevices] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channels: 1,
  });

  // Refs
  const audioLevelRef = useRef(null);
  const volumeRef = useRef(null);

  /**
   * Handle audio toggle
   */
  const handleAudioToggle = async () => {
    try {
      await toggleAudio(!isAudioEnabled);
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  /**
   * Handle mute toggle
   */
  const handleMuteToggle = async () => {
    try {
      await toggleMute(!isMuted);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  };

  /**
   * Handle device change
   */
  const handleDeviceChange = async (deviceType, deviceId) => {
    try {
      await changeAudioDevice(deviceType, deviceId);
      setShowDevices(false);
    } catch (error) {
      console.error('Failed to change audio device:', error);
    }
  };

  /**
   * Handle volume change
   */
  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    // Apply volume to audio context if available
    if (volumeRef.current) {
      volumeRef.current.gain.value = newVolume;
    }
  };

  /**
   * Handle audio settings change
   */
  const handleSettingsChange = (setting, value) => {
    setAudioSettings((prev) => ({
      ...prev,
      [setting]: value,
    }));

    // Apply settings to audio context
    // This would integrate with the actual audio processing
    console.log('Audio setting changed:', setting, value);
  };

  /**
   * Get audio level color
   */
  const getAudioLevelColor = (level) => {
    if (level < 0.3) return '#4CAF50'; // Green
    if (level < 0.7) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  /**
   * Get audio quality status
   */
  const getAudioQualityStatus = () => {
    const quality = qualityMetrics?.audio?.quality || 0;
    if (quality >= 0.8) return { status: 'excellent', color: '#4CAF50', text: 'Excellent' };
    if (quality >= 0.6) return { status: 'good', color: '#8BC34A', text: 'Good' };
    if (quality >= 0.4) return { status: 'fair', color: '#FF9800', text: 'Fair' };
    return { status: 'poor', color: '#F44336', text: 'Poor' };
  };

  // Update audio level visualization
  useEffect(() => {
    if (audioLevelRef.current && showAudioLevel) {
      const levelElement = audioLevelRef.current;
      const levelPercentage = Math.min(audioLevel * 100, 100);
      levelElement.style.width = `${levelPercentage}%`;
      levelElement.style.backgroundColor = getAudioLevelColor(audioLevel);
    }
  }, [audioLevel, showAudioLevel]);

  const audioQuality = getAudioQualityStatus();

  return (
    <div className={`audio-controls ${className}`} style={style}>
      {/* Main Controls */}
      <div className="audio-controls__main">
        {/* Audio Toggle */}
        <button
          className={`audio-controls__button audio-controls__audio-toggle ${
            isAudioEnabled ? 'audio-controls__button--active' : 'audio-controls__button--inactive'
          }`}
          onClick={handleAudioToggle}
          title={isAudioEnabled ? 'Disable Audio' : 'Enable Audio'}
        >
          {isAudioEnabled ? '🎤' : '🎤'}
          <span className="audio-controls__button-text">
            {isAudioEnabled ? 'Audio On' : 'Audio Off'}
          </span>
        </button>

        {/* Mute Toggle */}
        <button
          className={`audio-controls__button audio-controls__mute-toggle ${
            isMuted ? 'audio-controls__button--muted' : 'audio-controls__button--unmuted'
          }`}
          onClick={handleMuteToggle}
          disabled={!isAudioEnabled}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
          <span className="audio-controls__button-text">{isMuted ? 'Muted' : 'Unmuted'}</span>
        </button>

        {/* Audio Level Indicator */}
        {showAudioLevel && (
          <div className="audio-controls__level-container">
            <div className="audio-controls__level-background">
              <div ref={audioLevelRef} className="audio-controls__level-bar"></div>
            </div>
            <span className="audio-controls__level-text">{Math.round(audioLevel * 100)}%</span>
          </div>
        )}

        {/* Audio Quality Indicator */}
        <div className="audio-controls__quality">
          <div
            className={`audio-controls__quality-indicator audio-controls__quality--${audioQuality.status}`}
            style={{ backgroundColor: audioQuality.color }}
            title={`Audio Quality: ${audioQuality.text}`}
          >
            <span className="audio-controls__quality-text">{audioQuality.text}</span>
          </div>
        </div>
      </div>

      {/* Volume Control */}
      {showVolumeControl && (
        <div className="audio-controls__volume">
          <label className="audio-controls__volume-label">Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="audio-controls__volume-slider"
          />
          <span className="audio-controls__volume-value">{Math.round(volume * 100)}%</span>
        </div>
      )}

      {/* Device Selector */}
      {showDeviceSelector && (
        <div className="audio-controls__devices">
          <button
            className="audio-controls__devices-button"
            onClick={() => setShowDevices(!showDevices)}
            title="Audio Devices"
          >
            🎧 Devices
          </button>

          {showDevices && (
            <div className="audio-controls__devices-panel">
              <div className="audio-controls__devices-section">
                <h4>Input Devices</h4>
                {audioDevices.input.map((device) => (
                  <button
                    key={device.deviceId}
                    className={`audio-controls__device-option ${
                      selectedDevices.input === device.deviceId
                        ? 'audio-controls__device-option--selected'
                        : ''
                    }`}
                    onClick={() => handleDeviceChange('input', device.deviceId)}
                  >
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </button>
                ))}
              </div>

              <div className="audio-controls__devices-section">
                <h4>Output Devices</h4>
                {audioDevices.output.map((device) => (
                  <button
                    key={device.deviceId}
                    className={`audio-controls__device-option ${
                      selectedDevices.output === device.deviceId
                        ? 'audio-controls__device-option--selected'
                        : ''
                    }`}
                    onClick={() => handleDeviceChange('output', device.deviceId)}
                  >
                    {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Controls */}
      {showAdvancedControls && (
        <div className="audio-controls__advanced">
          <button
            className="audio-controls__advanced-button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Advanced Audio Settings"
          >
            ⚙️ Advanced
          </button>

          {showAdvanced && (
            <div className="audio-controls__advanced-panel">
              <h4>Audio Processing</h4>

              <div className="audio-controls__setting">
                <label>
                  <input
                    type="checkbox"
                    checked={audioSettings.echoCancellation}
                    onChange={(e) => handleSettingsChange('echoCancellation', e.target.checked)}
                  />
                  Echo Cancellation
                </label>
              </div>

              <div className="audio-controls__setting">
                <label>
                  <input
                    type="checkbox"
                    checked={audioSettings.noiseSuppression}
                    onChange={(e) => handleSettingsChange('noiseSuppression', e.target.checked)}
                  />
                  Noise Suppression
                </label>
              </div>

              <div className="audio-controls__setting">
                <label>
                  <input
                    type="checkbox"
                    checked={audioSettings.autoGainControl}
                    onChange={(e) => handleSettingsChange('autoGainControl', e.target.checked)}
                  />
                  Auto Gain Control
                </label>
              </div>

              <div className="audio-controls__setting">
                <label>Sample Rate:</label>
                <select
                  value={audioSettings.sampleRate}
                  onChange={(e) => handleSettingsChange('sampleRate', parseInt(e.target.value))}
                >
                  <option value={16000}>16 kHz</option>
                  <option value={22050}>22.05 kHz</option>
                  <option value={44100}>44.1 kHz</option>
                  <option value={48000}>48 kHz</option>
                </select>
              </div>

              <div className="audio-controls__setting">
                <label>Channels:</label>
                <select
                  value={audioSettings.channels}
                  onChange={(e) => handleSettingsChange('channels', parseInt(e.target.value))}
                >
                  <option value={1}>Mono</option>
                  <option value={2}>Stereo</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Statistics */}
      <div className="audio-controls__stats">
        <div className="audio-controls__stat">
          <span className="audio-controls__stat-label">Latency:</span>
          <span className="audio-controls__stat-value">
            {qualityMetrics?.audio?.latency || 0}ms
          </span>
        </div>

        <div className="audio-controls__stat">
          <span className="audio-controls__stat-label">Packet Loss:</span>
          <span className="audio-controls__stat-value">
            {((qualityMetrics?.audio?.packetLoss || 0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioControls;
