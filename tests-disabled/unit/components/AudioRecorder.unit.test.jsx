import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import { AudioRecorder } from '../../../src/components/AudioRecorder';
import { generateAudioBuffer, createMockMediaStream, createMockAudioContext } from '../../utils/audio-test-utils';

// Mock the translation hook
jest.mock('../../../src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key) => key, // Simple translation mock
  }),
}));

describe('AudioRecorder', () => {
  let mockMediaStream;
  let mockAudioContext;
  
  beforeEach(() => {
    // Create fresh mocks for each test
    mockMediaStream = createMockMediaStream();
    mockAudioContext = createMockAudioContext();
    
    // Mock the browser APIs
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
    };
    
    global.AudioContext = jest.fn(() => mockAudioContext);
    global.MediaRecorder = jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      ondataavailable: null,
      onerror: null,
      onstop: null,
      state: 'inactive',
      stream: mockMediaStream,
    }));
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  const renderComponent = (props = {}) => {
    const defaultProps = {
      onRecordingStart: jest.fn(),
      onRecordingStop: jest.fn(),
      onTranscription: jest.fn(),
      onError: jest.fn(),
      ...props,
    };
    
    return render(
      <RecoilRoot>
        <AudioRecorder {...defaultProps} />
      </RecoilRoot>
    );
  };
  
  test('renders with default state', () => {
    renderComponent();
    
    // Verify the record button is rendered
    expect(screen.getByRole('button', { name: /start.recording/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stop.recording/i })).not.toBeInTheDocument();
  });
  
  test('starts and stops recording', async () => {
    const onRecordingStart = jest.fn();
    const onRecordingStop = jest.fn();
    
    renderComponent({ onRecordingStart, onRecordingStop });
    
    // Click the record button
    const recordButton = screen.getByRole('button', { name: /start.recording/i });
    fireEvent.click(recordButton);
    
    // Verify recording started
    await waitFor(() => {
      expect(onRecordingStart).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /stop.recording/i })).toBeInTheDocument();
    });
    
    // Click stop
    const stopButton = screen.getByRole('button', { name: /stop.recording/i });
    fireEvent.click(stopButton);
    
    // Verify recording stopped
    await waitFor(() => {
      expect(onRecordingStop).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /start.recording/i })).toBeInTheDocument();
    });
  });
  
  test('handles recording errors', async () => {
    const error = new Error('Microphone access denied');
    const onError = jest.fn();
    
    // Mock getUserMedia to reject
    global.navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(error);
    
    renderComponent({ onError });
    
    // Click the record button
    const recordButton = screen.getByRole('button', { name: /start.recording/i });
    fireEvent.click(recordButton);
    
    // Verify error was handled
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
  
  test('displays recording indicator when recording', async () => {
    renderComponent();
    
    // Start recording
    const recordButton = screen.getByRole('button', { name: /start.recording/i });
    fireEvent.click(recordButton);
    
    // Verify recording indicator is shown
    await waitFor(() => {
      expect(screen.getByTestId('recording-indicator')).toBeInTheDocument();
    });
  });
  
  test('disables button when disabled prop is true', () => {
    renderComponent({ disabled: true });
    
    const button = screen.getByRole('button', { name: /start.recording/i });
    expect(button).toBeDisabled();
  });
  
  test('calls onTranscription when transcription is received', async () => {
    const mockTranscription = 'Hello, world!';
    const onTranscription = jest.fn();
    
    // Mock the transcription service
    const { transcribe } = require('../../../../src/services/stt/whisper');
    transcribe.mockResolvedValue({
      text: mockTranscription,
      language: 'en',
      isFinal: true,
    });
    
    renderComponent({ onTranscription });
    
    // Simulate receiving audio data
    const audioBuffer = generateAudioBuffer(1.0); // 1 second of audio
    
    // This would normally be called by the AudioProcessor
    await waitFor(() => {
      const event = new Event('audiodata');
      event.data = audioBuffer;
      window.dispatchEvent(event);
    });
    
    // Verify transcription was processed
    await waitFor(() => {
      expect(onTranscription).toHaveBeenCalledWith({
        text: mockTranscription,
        language: 'en',
        isFinal: true,
      });
    });
  });
});
