import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Create a test wrapper that provides the translation context
const TestWrapper = ({ children }) => {
  const mockT = (key, params = {}) => {
    const translations = {
      'startRecording': 'Start Recording',
      'stopRecording': 'Stop Recording',
      'recording': 'Recording',
      'permissionDenied': 'Microphone access denied',
      'elapsedTime': 'Elapsed Time: {time}'
    };

    let result = translations[key] || key;
    
    // Handle parameters in translation strings
    Object.entries(params).forEach(([param, value]) => {
      result = result.replace(`{${param}}`, value);
    });
    
    return result;
  };

  // Mock the useTranslation hook
  jest.doMock('../../../../src/hooks/useTranslation', () => ({
    __esModule: true,
    default: () => ({
      t: mockT
    })
  }));

  // Dynamically import the component after setting up the mock
  const { AudioRecorder } = require('../../../../src/components/AudioRecorder');
  
  return React.cloneElement(children, { AudioRecorder });
};

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

// Mock the MediaRecorder API
global.MediaStream = jest.fn(() => ({
  getTracks: jest.fn(() => [
    { stop: jest.fn() }
  ])
}));

global.MediaRecorder = jest.fn().mockImplementation((stream) => ({
  start: jest.fn(),
  stop: jest.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  stream: stream,
  pause: jest.fn(),
  requestData: jest.fn(),
  resume: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

describe('AudioRecorder', () => {
  let AudioRecorder;
  const mockOnRecordingStart = jest.fn();
  const mockOnRecordingStop = jest.fn();
  const mockOnTranscription = jest.fn();
  const mockOnError = jest.fn();

  // Load the component before each test
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset modules and re-import the component
    jest.resetModules();
    const module = await import('../../../../src/components/AudioRecorder.jsx');
    AudioRecorder = module.AudioRecorder || module.default;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <TestWrapper>
        <AudioRecorder
          onRecordingStart={mockOnRecordingStart}
          onRecordingStop={mockOnRecordingStop}
          onTranscription={mockOnTranscription}
          onError={mockOnError}
          {...props}
        />
      </TestWrapper>
    );
  };

  test('renders with start recording button', () => {
    renderComponent();
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });

  test('starts recording when button is clicked', async () => {
    const mockStream = { getTracks: jest.fn(() => [{ stop: jest.fn() }]) };
    const mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      state: 'inactive',
      ondataavailable: null,
      onstop: null,
      stream: mockStream,
    };
    
    global.MediaRecorder.mockImplementationOnce(() => mockMediaRecorder);
    
    // Mock getUserMedia to resolve with a mock stream
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream)
    };

    renderComponent();
    
    const button = screen.getByText('Start Recording');
    await act(async () => {
      fireEvent.click(button);
      // Fast-forward time to account for async operations
      jest.advanceTimersByTime(100);
    });

    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockMediaRecorder.start).toHaveBeenCalled();
    expect(mockOnRecordingStart).toHaveBeenCalled();
    expect(screen.getByText('Stop Recording')).toBeInTheDocument();
  });

  test('stops recording and calls onRecordingStop', async () => {
    const mockStream = { getTracks: jest.fn(() => [{ stop: jest.fn() }]) };
    const mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      state: 'recording',
      ondataavailable: jest.fn(),
      onstop: jest.fn(),
      stream: mockStream,
    };
    
    global.MediaRecorder.mockImplementationOnce(() => mockMediaRecorder);
    
    // Mock getUserMedia to resolve with a mock stream
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream)
    };

    renderComponent();
    
    // Start recording
    const startButton = screen.getByText('Start Recording');
    await act(async () => {
      fireEvent.click(startButton);
      jest.advanceTimersByTime(100);
    });

    // Stop recording
    const stopButton = screen.getByText('Stop Recording');
    await act(async () => {
      fireEvent.click(stopButton);
      // Trigger the onstop handler
      if (mockMediaRecorder.onstop) {
        mockMediaRecorder.onstop();
      }
      jest.advanceTimersByTime(100);
    });

    expect(mockMediaRecorder.stop).toHaveBeenCalled();
    expect(mockOnRecordingStop).toHaveBeenCalled();
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });

  test('handles recording permission denied', async () => {
    // Mock getUserMedia to reject with permission denied
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
    };

    renderComponent();
    
    const button = screen.getByText('Start Recording');
    await act(async () => {
      fireEvent.click(button);
      jest.advanceTimersByTime(100);
    });

    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });

  test('displays elapsed time while recording', async () => {
    const mockStream = { getTracks: jest.fn(() => [{ stop: jest.fn() }]) };
    const mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      state: 'inactive',
      ondataavailable: null,
      onstop: null,
      stream: mockStream,
    };
    
    global.MediaRecorder.mockImplementationOnce(() => mockMediaRecorder);
    
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream)
    };

    renderComponent();
    
    // Start recording
    const button = screen.getByText('Start Recording');
    await act(async () => {
      fireEvent.click(button);
      jest.advanceTimersByTime(100);
    });

    // Fast-forward time by 5 seconds
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    // Check if elapsed time is displayed
    expect(screen.getByText('Elapsed Time: 00:05')).toBeInTheDocument();
  });

  test('cleans up resources on unmount', async () => {
    const mockTrack = { stop: jest.fn() };
    const mockStream = { getTracks: jest.fn(() => [mockTrack]) };
    const mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      state: 'recording',
      ondataavailable: null,
      onstop: null,
      stream: mockStream,
    };
    
    global.MediaRecorder.mockImplementationOnce(() => mockMediaRecorder);
    
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(mockStream)
    };

    const { unmount } = renderComponent();
    
    // Start recording
    const button = screen.getByText('Start Recording');
    await act(async () => {
      fireEvent.click(button);
      jest.advanceTimersByTime(100);
    });

    // Unmount the component
    await act(async () => {
      unmount();
    });

    expect(mockMediaRecorder.stop).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  test('handles disabled state', () => {
    renderComponent({ disabled: true });
    const button = screen.getByText('Start Recording');
    expect(button).toBeDisabled();
  });
});
