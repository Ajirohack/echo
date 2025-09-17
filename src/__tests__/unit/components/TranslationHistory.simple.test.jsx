import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import TranslationHistory from '../../../src/components/TranslationHistory'; // Default import

// Minimal mock for useTranslation
jest.mock('../../../src/hooks/useTranslation', () => ({
  __esModule: true,
  default: () => ({
    t: (key) => key, // Simple translation mock
  }),
}));

describe('TranslationHistory - Simple Test', () => {
  const mockTranslations = [
    {
      id: '1',
      originalText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      timestamp: Date.now(),
    },
  ];

  const defaultProps = {
    translations: mockTranslations,
    onClearAll: jest.fn(),
    onDelete: jest.fn(),
    onSelect: jest.fn(),
  };

  test('renders without crashing', () => {
    render(
      <RecoilRoot>
        <TranslationHistory {...defaultProps} />
      </RecoilRoot>
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hola')).toBeInTheDocument();
  });
});
