// Import the render method from @testing-library/react
import { render } from '@testing-library/react';
import React from 'react';

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Mock translation function for testing
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

// Mock useTranslation hook for testing
export const mockUseTranslation = () => ({
  t: mockT
});

// Create a custom render function that includes providers
const customRender = (ui, options = {}) => {
  const Wrapper = ({ children }) => (
    <React.Fragment>
      {children}
    </React.Fragment>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

// Override the render method
export { customRender as render };

export * from '@testing-library/user-event';

export { mockT, mockUseTranslation };
