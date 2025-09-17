import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SimpleTranslationHistory from '../../../src/components/SimpleTranslationHistory';

// Mock the useTranslation hook
jest.mock('../../../src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key) =>
      ({
        noTranslationHistory: 'No translations yet',
        noMatchingTranslations: 'No matching translations',
        searchPlaceholder: 'Search translations...',
        delete: 'Delete',
        translationHistory: 'Translation History',
      })[key] || key,
  }),
}));

describe('SimpleTranslationHistory', () => {
  const mockTranslations = [
    {
      id: '1',
      originalText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: 'en',
      targetLanguage: 'es',
    },
    {
      id: '2',
      originalText: 'Goodbye',
      translatedText: 'Adiós',
      sourceLanguage: 'en',
      targetLanguage: 'es',
    },
  ];

  test('renders without translations', () => {
    render(<SimpleTranslationHistory translations={[]} />);
    expect(screen.getByText('No translations yet')).toBeInTheDocument();
  });

  test('renders with translations', () => {
    render(<SimpleTranslationHistory translations={mockTranslations} />);

    expect(screen.getByText('Hello → Hola')).toBeInTheDocument();
    expect(screen.getByText('Goodbye → Adiós')).toBeInTheDocument();
    expect(screen.getByText('From: en To: es')).toBeInTheDocument();
  });

  test('calls onSelect when a translation is clicked', () => {
    const handleSelect = jest.fn();
    render(<SimpleTranslationHistory translations={mockTranslations} onSelect={handleSelect} />);

    fireEvent.click(screen.getByText('Hello → Hola'));
    expect(handleSelect).toHaveBeenCalledWith(mockTranslations[0]);
  });

  test('calls onDelete when delete button is clicked', () => {
    const handleDelete = jest.fn();
    render(<SimpleTranslationHistory translations={mockTranslations} onDelete={handleDelete} />);

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(handleDelete).toHaveBeenCalledWith(mockTranslations[0], expect.any(Object));
  });

  test('filters translations based on search query', () => {
    render(<SimpleTranslationHistory translations={mockTranslations} />);

    const searchInput = screen.getByPlaceholderText('Search translations...');
    fireEvent.change(searchInput, { target: { value: 'Hello' } });

    expect(screen.getByText('Hello → Hola')).toBeInTheDocument();
    expect(screen.queryByText('Goodbye → Adiós')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Bonjour' } });
    expect(screen.getByText('No matching translations')).toBeInTheDocument();
  });

  test('calls onSelect when a translation is clicked', () => {
    const handleSelect = jest.fn();

    render(<SimpleTranslationHistory translations={mockTranslations} onSelect={handleSelect} />);

    fireEvent.click(screen.getByText('Hello → Hola'));
    expect(handleSelect).toHaveBeenCalledWith(mockTranslations[0]);
  });

  test('calls onDelete when delete button is clicked', () => {
    const handleDelete = jest.fn();

    const { rerender } = render(
      <SimpleTranslationHistory translations={mockTranslations} onDelete={handleDelete} />
    );

    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);

    // The component calls onDelete with just the translation object
    expect(handleDelete).toHaveBeenCalledWith(mockTranslations[0]);

    // Re-render with empty translations to simulate deletion
    rerender(<SimpleTranslationHistory translations={[]} onDelete={handleDelete} />);

    expect(screen.getByText('No translations yet')).toBeInTheDocument();
  });
});
