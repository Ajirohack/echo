import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecoilRoot } from 'recoil';
import { LanguageSelector } from '../../../src/components/LanguageSelector';

// Mock the translation hook
jest.mock('../../../src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key) => key, // Simple translation mock
  }),
}));

// Mock the translation service
jest.mock('../../../src/services/translation/translation-service');
const { MockTranslationService } = require('../../__mocks__/translation-service');

// Mock the actual translation service with our mock implementation
jest.mock('../../../src/services/translation/translation-service', () => ({
  TranslationService: jest.fn().mockImplementation(() => new MockTranslationService())
}));

describe('LanguageSelector', () => {
  const defaultProps = {
    type: 'source',
    value: 'en',
    onChange: jest.fn(),
    disabled: false,
    excludeLanguages: [],
  };
  
  const renderComponent = (props = {}) => {
    return render(
      <RecoilRoot>
        <LanguageSelector {...defaultProps} {...props} />
      </RecoilRoot>
    );
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('renders with default props', async () => {
    renderComponent();
    
    // Should render the select element
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).not.toBeDisabled();
    
    // Should have the default value selected
    expect(select.value).toBe('en');
  });
  
  test('loads available languages on mount', async () => {
    renderComponent();
    
    // Wait for languages to load
    await waitFor(() => {
      // Check if some expected languages are in the document
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.getByText('French')).toBeInTheDocument();
    });
  });
  
  test('calls onChange when a different language is selected', async () => {
    const onChange = jest.fn();
    renderComponent({ onChange });
    
    // Wait for languages to load
    await waitFor(() => {
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });
    
    // Select Spanish
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'es' } });
    
    // Verify onChange was called with the new value
    expect(onChange).toHaveBeenCalledWith('es');
  });
  
  test('disables the select when disabled prop is true', () => {
    renderComponent({ disabled: true });
    
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
  });
  
  test('excludes languages specified in excludeLanguages prop', async () => {
    // Exclude Spanish and French
    renderComponent({ excludeLanguages: ['es', 'fr'] });
    
    // Wait for languages to load
    await waitFor(() => {
      // English should still be there
      expect(screen.getByText('English')).toBeInTheDocument();
      
      // Spanish and French should be excluded
      expect(screen.queryByText('Spanish')).not.toBeInTheDocument();
      expect(screen.queryByText('French')).not.toBeInTheDocument();
    });
  });
  
  test('shows loading state while languages are loading', () => {
    // Mock the service to delay returning languages
    const { TranslationService } = require('../../../src/services/translation/translation-service');
    const mockInstance = new MockTranslationService();
    mockInstance.getSupportedLanguages = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
    );
    TranslationService.mockImplementation(() => mockInstance);
    
    renderComponent();
    
    // Should show loading state
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
  
  test('handles errors when loading languages', async () => {
    // Mock the service to reject with an error
    const { TranslationService } = require('../../../src/services/translation/translation-service');
    const mockInstance = new MockTranslationService();
    mockInstance.getSupportedLanguages = jest.fn().mockRejectedValue(new Error('Failed to load languages'));
    TranslationService.mockImplementation(() => mockInstance);
    
    renderComponent();
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/error.loading.languages/i)).toBeInTheDocument();
    });
  });
  
  test('filters languages based on search input', async () => {
    renderComponent();
    
    // Wait for languages to load
    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
    });
    
    // Type in the search box
    const searchInput = screen.getByPlaceholderText(/search.languages/i);
    fireEvent.change(searchInput, { target: { value: 'span' } });
    
    // Only Spanish should be visible
    await waitFor(() => {
      expect(screen.getByText('Spanish')).toBeInTheDocument();
      expect(screen.queryByText('English')).not.toBeInTheDocument();
      expect(screen.queryByText('French')).not.toBeInTheDocument();
    });
  });
});
