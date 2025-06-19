import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../hooks/useTranslation';
import '../styles/AudioRecorder.css';

/**
 * AudioRecorder component for recording audio from the microphone
 */
export const AudioRecorder = ({
  onRecordingStart,
  onRecordingStop,
  onTranscription,
  onError,
  disabled = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [mediaRecorder]);

  // Handle timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Format seconds into MM:SS format
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle data available event from MediaRecorder
  const handleDataAvailable = useCallback((event) => {
    if (event.data.size > 0) {
      setAudioChunks(prev => [...prev, event.data]);
    }
  }, []);

  // Handle recording stop
  const handleStop = useCallback(() => {
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      if (onTranscription) {
        // In a real app, you would send the audio blob to a speech-to-text service
        onTranscription(audioBlob);
      }
      setAudioChunks([]);
    }
  }, [audioChunks, onTranscription]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = handleDataAvailable;
      recorder.onstop = handleStop;
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setElapsedTime(0);
      setPermissionDenied(false);
      
      if (onRecordingStart) {
        onRecordingStart();
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setPermissionDenied(true);
      if (onError) {
        onError(error);
      }
    }
  }, [handleDataAvailable, handleStop, onError, onRecordingStart]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      
      // Stop all tracks in the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (onRecordingStop) {
        onRecordingStop();
      }
    }
  }, [mediaRecorder, onRecordingStop]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className={`audio-recorder ${className}`}>
      <button
        type="button"
        className={`record-button ${isRecording ? 'recording' : ''}`}
        onClick={toggleRecording}
        disabled={disabled || permissionDenied}
        aria-label={isRecording ? t('Stop recording') : t('Start recording')}
      >
        <span className="button-icon">
          {isRecording ? (
            <span className="stop-icon" />
          ) : (
            <span className="mic-icon" />
          )}
        </span>
        <span className="button-text">
          {isRecording ? t('Stop') : t('Record')}
        </span>
      </button>
      
      {isRecording && (
        <div className="recording-indicator" data-testid="recording-indicator">
          <span className="pulse" />
          <span className="time">{formatTime(elapsedTime)}</span>
        </div>
      )}
      
      {permissionDenied && (
        <div className="error-message">
          {t('Microphone access was denied. Please check your browser permissions.')}
        </div>
      )}
    </div>
  );
};

AudioRecorder.propTypes = {
  /** Callback when recording starts */
  onRecordingStart: PropTypes.func,
  /** Callback when recording stops */
  onRecordingStop: PropTypes.func,
  /** Callback with audio data when recording is complete */
  onTranscription: PropTypes.func,
  /** Error handler */
  onError: PropTypes.func,
  /** Disable the recorder */
  disabled: PropTypes.bool,
  /** Additional CSS class */
  className: PropTypes.string,
};

// For backward compatibility
export default AudioRecorder;
