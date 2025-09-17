import React, { useState, useEffect } from 'react';
import { useEchoRTC } from './EchoRTCProvider.jsx';
import './ParticipantsList.css';

/**
 * Participants List Component
 * Displays and manages room participants
 */
const ParticipantsList = ({
  participants = [],
  localParticipant = null,
  showAudioLevels = true,
  showConnectionStatus = true,
  showParticipantActions = true,
  maxDisplayed = 10,
  className = '',
  style = {},
}) => {
  const { qualityMetrics, isConnected } = useEchoRTC();

  // Local state
  const [expandedParticipant, setExpandedParticipant] = useState(null);
  const [sortBy, setSortBy] = useState('joinTime'); // joinTime, name, audioLevel
  const [filterText, setFilterText] = useState('');
  const [showAll, setShowAll] = useState(false);

  /**
   * Get participant status
   */
  const getParticipantStatus = (participant) => {
    if (!participant.isConnected)
      return { status: 'disconnected', color: '#F44336', text: 'Disconnected' };
    if (participant.isSpeaking) return { status: 'speaking', color: '#4CAF50', text: 'Speaking' };
    if (participant.audioEnabled)
      return { status: 'connected', color: '#2196F3', text: 'Connected' };
    return { status: 'muted', color: '#FF9800', text: 'Muted' };
  };

  /**
   * Get audio level color
   */
  const getAudioLevelColor = (level) => {
    if (level < 0.3) return '#4CAF50';
    if (level < 0.7) return '#FF9800';
    return '#F44336';
  };

  /**
   * Format connection duration
   */
  const formatDuration = (startTime) => {
    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Sort participants
   */
  const sortParticipants = (participantsList) => {
    return [...participantsList].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'audioLevel':
          return (b.audioLevel || 0) - (a.audioLevel || 0);
        case 'joinTime':
        default:
          return (a.joinTime || 0) - (b.joinTime || 0);
      }
    });
  };

  /**
   * Filter participants
   */
  const filterParticipants = (participantsList) => {
    if (!filterText) return participantsList;
    return participantsList.filter(
      (participant) =>
        (participant.name || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (participant.id || '').toLowerCase().includes(filterText.toLowerCase())
    );
  };

  /**
   * Handle participant action
   */
  const handleParticipantAction = (participantId, action) => {
    console.log(`Participant action: ${action} for ${participantId}`);
    // This would integrate with the actual RTC service
    switch (action) {
      case 'mute':
        // Mute participant
        break;
      case 'kick':
        // Remove participant
        break;
      case 'promote':
        // Promote to moderator
        break;
      default:
        break;
    }
  };

  // Process participants list
  const allParticipants = localParticipant ? [localParticipant, ...participants] : participants;
  const filteredParticipants = filterParticipants(allParticipants);
  const sortedParticipants = sortParticipants(filteredParticipants);
  const displayedParticipants = showAll
    ? sortedParticipants
    : sortedParticipants.slice(0, maxDisplayed);

  return (
    <div className={`participants-list ${className}`} style={style}>
      {/* Header */}
      <div className="participants-list__header">
        <div className="participants-list__title">
          <h3>👥 Participants</h3>
          <span className="participants-list__count">{allParticipants.length}</span>
        </div>

        <div className="participants-list__controls">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="participants-list__sort"
            title="Sort by"
          >
            <option value="joinTime">Join Time</option>
            <option value="name">Name</option>
            <option value="audioLevel">Audio Level</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="participants-list__search">
        <input
          type="text"
          placeholder="Search participants..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="participants-list__search-input"
        />
      </div>

      {/* Participants */}
      <div className="participants-list__content">
        {displayedParticipants.length === 0 ? (
          <div className="participants-list__empty">
            <p>No participants found</p>
          </div>
        ) : (
          displayedParticipants.map((participant) => {
            const status = getParticipantStatus(participant);
            const isLocal = participant.id === localParticipant?.id;
            const isExpanded = expandedParticipant === participant.id;

            return (
              <div
                key={participant.id}
                className={`participants-list__participant ${
                  isLocal ? 'participants-list__participant--local' : ''
                } ${isExpanded ? 'participants-list__participant--expanded' : ''}`}
              >
                {/* Main Info */}
                <div
                  className="participants-list__participant-main"
                  onClick={() => setExpandedParticipant(isExpanded ? null : participant.id)}
                >
                  {/* Avatar */}
                  <div className="participants-list__avatar">
                    {participant.avatar ? (
                      <img
                        src={participant.avatar}
                        alt={participant.name}
                        className="participants-list__avatar-image"
                      />
                    ) : (
                      <div className="participants-list__avatar-placeholder">
                        {(participant.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Status Indicator */}
                    <div
                      className={`participants-list__status participants-list__status--${status.status}`}
                      style={{ backgroundColor: status.color }}
                      title={status.text}
                    ></div>
                  </div>

                  {/* Info */}
                  <div className="participants-list__info">
                    <div className="participants-list__name">
                      {participant.name || `User ${participant.id.slice(0, 8)}`}
                      {isLocal && <span className="participants-list__local-badge">(You)</span>}
                    </div>

                    <div className="participants-list__details">
                      {showConnectionStatus && (
                        <span className="participants-list__connection">{status.text}</span>
                      )}

                      {participant.joinTime && (
                        <span className="participants-list__duration">
                          {formatDuration(participant.joinTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Audio Level */}
                  {showAudioLevels && (
                    <div className="participants-list__audio">
                      <div className="participants-list__audio-level">
                        <div
                          className="participants-list__audio-bar"
                          style={{
                            width: `${Math.min((participant.audioLevel || 0) * 100, 100)}%`,
                            backgroundColor: getAudioLevelColor(participant.audioLevel || 0),
                          }}
                        ></div>
                      </div>

                      <div className="participants-list__audio-icons">
                        {participant.audioEnabled ? (participant.isMuted ? '🔇' : '🎤') : '🚫'}
                      </div>
                    </div>
                  )}

                  {/* Expand Arrow */}
                  <div className="participants-list__expand">{isExpanded ? '▼' : '▶'}</div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="participants-list__participant-details">
                    {/* Connection Info */}
                    <div className="participants-list__detail-section">
                      <h5>Connection</h5>
                      <div className="participants-list__detail-grid">
                        <div className="participants-list__detail-item">
                          <span className="participants-list__detail-label">Status:</span>
                          <span className="participants-list__detail-value">{status.text}</span>
                        </div>

                        <div className="participants-list__detail-item">
                          <span className="participants-list__detail-label">Quality:</span>
                          <span className="participants-list__detail-value">
                            {Math.round((participant.connectionQuality || 0) * 100)}%
                          </span>
                        </div>

                        <div className="participants-list__detail-item">
                          <span className="participants-list__detail-label">Latency:</span>
                          <span className="participants-list__detail-value">
                            {participant.latency || 0}ms
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Audio Info */}
                    <div className="participants-list__detail-section">
                      <h5>Audio</h5>
                      <div className="participants-list__detail-grid">
                        <div className="participants-list__detail-item">
                          <span className="participants-list__detail-label">Level:</span>
                          <span className="participants-list__detail-value">
                            {Math.round((participant.audioLevel || 0) * 100)}%
                          </span>
                        </div>

                        <div className="participants-list__detail-item">
                          <span className="participants-list__detail-label">Device:</span>
                          <span className="participants-list__detail-value">
                            {participant.audioDevice || 'Default'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Translation Info */}
                    {participant.translationEnabled && (
                      <div className="participants-list__detail-section">
                        <h5>Translation</h5>
                        <div className="participants-list__detail-grid">
                          <div className="participants-list__detail-item">
                            <span className="participants-list__detail-label">Language:</span>
                            <span className="participants-list__detail-value">
                              {participant.language || 'Auto-detect'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {showParticipantActions && !isLocal && (
                      <div className="participants-list__actions">
                        <button
                          className="participants-list__action-button"
                          onClick={() => handleParticipantAction(participant.id, 'mute')}
                          title="Mute Participant"
                        >
                          🔇 Mute
                        </button>

                        <button
                          className="participants-list__action-button"
                          onClick={() => handleParticipantAction(participant.id, 'kick')}
                          title="Remove Participant"
                        >
                          🚪 Remove
                        </button>

                        <button
                          className="participants-list__action-button"
                          onClick={() => handleParticipantAction(participant.id, 'promote')}
                          title="Promote to Moderator"
                        >
                          👑 Promote
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Show More Button */}
        {!showAll && sortedParticipants.length > maxDisplayed && (
          <button className="participants-list__show-more" onClick={() => setShowAll(true)}>
            Show {sortedParticipants.length - maxDisplayed} more participants
          </button>
        )}

        {showAll && sortedParticipants.length > maxDisplayed && (
          <button className="participants-list__show-less" onClick={() => setShowAll(false)}>
            Show less
          </button>
        )}
      </div>

      {/* Footer Stats */}
      <div className="participants-list__footer">
        <div className="participants-list__stats">
          <div className="participants-list__stat">
            <span className="participants-list__stat-label">Connected:</span>
            <span className="participants-list__stat-value">
              {allParticipants.filter((p) => p.isConnected).length}
            </span>
          </div>

          <div className="participants-list__stat">
            <span className="participants-list__stat-label">Speaking:</span>
            <span className="participants-list__stat-value">
              {allParticipants.filter((p) => p.isSpeaking).length}
            </span>
          </div>

          <div className="participants-list__stat">
            <span className="participants-list__stat-label">Muted:</span>
            <span className="participants-list__stat-value">
              {allParticipants.filter((p) => p.isMuted).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantsList;
