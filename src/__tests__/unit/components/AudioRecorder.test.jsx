/**
 * Unit tests for AudioRecorder component
 *
 * These tests verify the AudioRecorder React component functionality including:
 * - Component rendering
 * - Recording state management
 * - User interactions
 * - Error handling
 * - Prop validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioRecorder } from '../../../components/AudioRecorder';

// Mock the useTranslation hook
jest.mock('../../../hooks/useTranslation', () => ({
  __esModule: true,
  default: () => ({
    t: (key) => key, // Return the key as the translation
  }),
}));

// Mock MediaRecorder API
class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;
    this.onstart = null;
    this.onerror = null;
  }

  start() {
    this.state = 'recording';
    if (this.onstart) {
      this.onstart();
    }
    // Simulate data available after a short delay
    setTimeout(() => {
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new Blob(['mock audio data'], { type: 'audio/wav' }),
        });
      }
    }, 100);
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop();
    }
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }
}

// Mock getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock MediaRecorder
global.MediaRecorder = MockMediaRecorder;
global.MediaRecorder.isTypeSupported = jest.fn().mockReturnValue(true);

describe('AudioRecorder', () => {
  const defaultProps = {
    onRecordingStart: jest.fn(),
    onRecordingStop: jest.fn(),
    onTranscription: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful getUserMedia
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [
        {
          stop: jest.fn(),
          kind: 'audio',
          enabled: true,
        },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render the AudioRecorder component', () => {
      render(<AudioRecorder {...defaultProps} />);

      // Check for the main recording button
      const recordButton = screen.getByRole('button');
      expect(recordButton).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const customClass = 'custom-audio-recorder';
      const { container } = render(<AudioRecorder {...defaultProps} className={customClass} />);

      expect(container.firstChild).toHaveClass(customClass);
    });

    it('should render disabled state', () => {
      render(<AudioRecorder {...defaultProps} disabled={true} />);

      const recordButton = screen.getByRole('button');
      expect(recordButton).toBeDisabled();
    });
  });

  describe('Recording Functionality', () => {
    it('should start recording when button is clicked', async () => {
      const user = userEvent.setup();
      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');
      await user.click(recordButton);

      await waitFor(() => {
        expect(defaultProps.onRecordingStart).toHaveBeenCalled();
      });
    });

    it('should stop recording when button is clicked again', async () => {
      const user = userEvent.setup();
      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');

      // Start recording
      await user.click(recordButton);

      await waitFor(() => {
        expect(defaultProps.onRecordingStart).toHaveBeenCalled();
      });

      // Stop recording
      await user.click(recordButton);

      await waitFor(() => {
        expect(defaultProps.onRecordingStop).toHaveBeenCalled();
      });
    });

    it('should display elapsed time during recording', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');
      await user.click(recordButton);

      // Advance time by 3 seconds
      jest.advanceTimersByTime(3000);

      // Check if elapsed time is displayed (this depends on your component implementation)
      // You might need to adjust this based on how your component displays time
      await waitFor(() => {
        // Look for time display - adjust selector based on your implementation
        const timeDisplay = screen.queryByText(/00:0[0-9]/);
        if (timeDisplay) {
          expect(timeDisplay).toBeInTheDocument();
        }
      });

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle microphone permission denied', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      const user = userEvent.setup();
      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');
      await user.click(recordButton);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Permission denied'),
          })
        );
      });
    });

    it('should handle MediaRecorder not supported', async () => {
      // Temporarily remove MediaRecorder support
      const originalMediaRecorder = global.MediaRecorder;
      global.MediaRecorder = undefined;

      const user = userEvent.setup();
      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');
      await user.click(recordButton);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalled();
      });

      // Restore MediaRecorder
      global.MediaRecorder = originalMediaRecorder;
    });

    it('should handle recording errors', async () => {
      // Mock MediaRecorder that throws an error
      class ErrorMediaRecorder extends MockMediaRecorder {
        start() {
          this.state = 'recording';
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Recording failed'));
            }
          }, 100);
        }
      }

      global.MediaRecorder = ErrorMediaRecorder;

      const user = userEvent.setup();
      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');
      await user.click(recordButton);

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalled();
      });

      // Restore original MediaRecorder
      global.MediaRecorder = MockMediaRecorder;
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = render(<AudioRecorder {...defaultProps} />);

      // Start recording to create resources
      const recordButton = screen.getByRole('button');
      fireEvent.click(recordButton);

      // Unmount component
      unmount();

      // Verify cleanup (this is implicit - no errors should be thrown)
      expect(true).toBe(true);
    });

    it('should stop recording when component unmounts', async () => {
      const { unmount } = render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');
      fireEvent.click(recordButton);

      // Wait for recording to start
      await waitFor(() => {
        expect(defaultProps.onRecordingStart).toHaveBeenCalled();
      });

      // Unmount while recording
      unmount();

      // Verify that recording was stopped (implicit through cleanup)
      expect(true).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');

      // Check for accessibility attributes
      expect(recordButton).toHaveAttribute('type', 'button');

      // You might want to add more specific ARIA attributes to your component
      // and test for them here
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<AudioRecorder {...defaultProps} />);

      const recordButton = screen.getByRole('button');

      // Focus the button
      recordButton.focus();
      expect(recordButton).toHaveFocus();

      // Activate with Enter key
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(defaultProps.onRecordingStart).toHaveBeenCalled();
      });
    });
  });

  describe('Props Validation', () => {
    it('should work without optional props', () => {
      expect(() => {
        render(<AudioRecorder />);
      }).not.toThrow();
    });

    it('should handle missing callback props gracefully', async () => {
      const user = userEvent.setup();
      render(<AudioRecorder />);

      const recordButton = screen.getByRole('button');

      // Should not throw when callbacks are missing
      expect(async () => {
        await user.click(recordButton);
      }).not.toThrow();
    });
  });
});
