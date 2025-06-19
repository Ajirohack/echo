import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import TranslationHistory from '../../../src/components/TranslationHistory';

// Mock the translation hook
jest.mock('../../../src/hooks/useTranslation', () => ({
  __esModule: true,
  default: () => ({
    t: (key, params) => {
      // Handle common translation keys used in the component
      const translations = {
        'history.clear.confirm': 'Are you sure you want to clear all history?',
        'history.clear': 'Clear History',
        'history.search.placeholder': 'Search translations...',
        'history.noItems': 'No translation history',
        'history.delete': 'Delete',
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
      };
      
      if (translations[key]) {
        return translations[key];
      }
      
      // Simple parameter replacement for dynamic content
      if (params) {
        return Object.entries(params).reduce(
          (result, [param, value]) => result.replace(`{{${param}}}`, value),
          key
        );
      }
      
      return key;
    },
  }),
}));

describe('TranslationHistory', () => {
  const mockTranslations = [
    {
      id: '1',
      sourceText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      timestamp: new Date('2023-01-01T12:00:00Z').getTime(),
    },
    {
      id: '2',
      sourceText: 'Goodbye',
      translatedText: 'Adiós',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      timestamp: new Date('2023-01-02T12:00:00Z').getTime(),
    },
  ];
  
  const defaultProps = {
    translations: mockTranslations,
    onClearAll: jest.fn(),
    onDelete: jest.fn(),
    onSelect: jest.fn(),
  };
  
  const renderComponent = (props = {}) => {
    return render(
      <RecoilRoot>
        <TranslationHistory {...defaultProps} {...props} />
      </RecoilRoot>
    );
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with translations', () => {
    renderComponent();
    
    // Check if translations are displayed
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Goodbye')).toBeInTheDocument();
    expect(screen.getByText('Adiós')).toBeInTheDocument();
    
    // Check if timestamps are formatted correctly
    expect(screen.getByText(/january 1, 2023/i)).toBeInTheDocument();
    expect(screen.getByText(/january 2, 2023/i)).toBeInTheDocument();
  });
  
  test('shows empty state when no translations', () => {
    renderComponent({ translations: [] });
    
    expect(screen.getByText('history.empty')).toBeInTheDocument();
  });
  
  test('calls onClearAll when clear button is clicked', () => {
    renderComponent();
    
    const clearButton = screen.getByRole('button', { name: /clear.all/i });
    fireEvent.click(clearButton);
    
    expect(defaultProps.onClearAll).toHaveBeenCalled();
  });
  
  test('calls onDelete when delete button is clicked', () => {
    renderComponent();
    
    // Get the first delete button
    const deleteButtons = screen.getAllByRole('button', { name: /×/i });
    fireEvent.click(deleteButtons[0]);
    
    // Check if onDelete was called with the correct translation object
    expect(defaultProps.onDelete).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      sourceText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: 'en',
      targetLanguage: 'es',
    }));
  });
  
  test('calls onSelect when a translation item is clicked', () => {
    renderComponent();
    
    // Get the first translation item
    const translationItem = screen.getByText('Hello').closest('.translation-item');
    fireEvent.click(translationItem);
    
    // Check if onSelect was called with the correct translation object
    expect(defaultProps.onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      sourceText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: 'en',
      targetLanguage: 'es',
    }));
  });
  
  test('filters translations based on search input', () => {
    renderComponent();
    
    // Type in the search box
    const searchInput = screen.getByPlaceholderText('history.search.placeholder');
    fireEvent.change(searchInput, { target: { value: 'hello' } });
    
    // Only the matching translation should be visible
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.queryByText('Goodbye')).not.toBeInTheDocument();
    expect(screen.queryByText('Adiós')).not.toBeInTheDocument();
  });
  
  test('disables clear button when there are no translations', () => {
    renderComponent({ translations: [] });
    
    const clearButton = screen.getByRole('button', { name: /clear.history/i });
    expect(clearButton).toBeDisabled();
  });
  
  test('shows language codes when language names are not available', () => {
    // Mock Intl.DisplayNames to return undefined for language names
    const originalDisplayNames = Intl.DisplayNames;
    global.Intl.DisplayNames = jest.fn().mockImplementation(() => ({
      of: () => undefined
    }));

    const translations = [
      {
        id: '3',
        originalText: 'Test',
        translatedText: 'Prueba',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        timestamp: Date.now(),
      },
    ];
    
    renderComponent({ translations });
    
    // Check if language codes are shown
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('ES')).toBeInTheDocument();
    
    // Restore original Intl.DisplayNames
    global.Intl.DisplayNames = originalDisplayNames;
  });
  
  test('handles long text with ellipsis', () => {
    const longText = 'This is a very long text that should be truncated with an ellipsis to prevent layout issues';
    const translations = [
      {
        id: '4',
        originalText: longText,
        translatedText: 'Texto muy largo que debe truncarse con puntos suspensivos',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        timestamp: Date.now(),
      },
    ];
    
    renderComponent({ translations });
    
    // Check if the text is present (ellipsis is handled by CSS, not by the component)
    const textElement = screen.getByText(longText);
    expect(textElement).toBeInTheDocument();
  });
});
