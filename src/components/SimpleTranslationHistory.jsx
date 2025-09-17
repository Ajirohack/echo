import React, { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../hooks/useTranslation';
import '../styles/TranslationHistory.css';

export const SimpleTranslationHistory = ({ translations = [], onSelect, onDelete }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [localTranslations, setLocalTranslations] = useState(translations);

  // Update local state when props change
  useEffect(() => {
    setLocalTranslations(translations);
  }, [translations]);

  // Filter translations based on search query
  const filteredTranslations = useMemo(() => {
    if (!searchQuery) return localTranslations;
    const query = searchQuery.toLowerCase();
    const filtered = localTranslations.filter(
      (translation) =>
        translation.originalText.toLowerCase().includes(query) ||
        translation.translatedText.toLowerCase().includes(query)
    );
    return filtered;
  }, [localTranslations, searchQuery]);

  // Show no translations message if there are no translations or no matches
  const showNoTranslations =
    localTranslations.length === 0 || (searchQuery && filteredTranslations.length === 0);

  const handleSelect = useCallback(
    (translation) => {
      if (onSelect) {
        onSelect(translation);
      }
    },
    [onSelect]
  );

  const handleDelete = useCallback(
    (translation, e) => {
      e.stopPropagation();
      const newTranslations = localTranslations.filter((t) => t.id !== translation.id);
      setLocalTranslations(newTranslations);
      if (onDelete) {
        onDelete(translation);
      }
    },
    [localTranslations, onDelete]
  );

  return (
    <div data-testid="translation-history" className="translation-history">
      <h2>{t('translationHistory')}</h2>
      <input
        type="text"
        placeholder={t('searchPlaceholder')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="search-input"
      />
      <div className="translation-list">
        {showNoTranslations ? (
          <p>
            {localTranslations.length === 0
              ? t('noTranslationHistory')
              : t('noMatchingTranslations')}
          </p>
        ) : (
          filteredTranslations.map((translation) => (
            <div
              key={translation.id}
              className="translation-item"
              onClick={() => handleSelect(translation)}
            >
              <div className="translation-text">
                {translation.originalText} → {translation.translatedText}
              </div>
              <div className="translation-meta">
                From: {translation.sourceLanguage} To: {translation.targetLanguage}
              </div>
              <button className="delete-button" onClick={(e) => handleDelete(translation, e)}>
                {t('delete')}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

SimpleTranslationHistory.propTypes = {
  translations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      originalText: PropTypes.string.isRequired,
      translatedText: PropTypes.string.isRequired,
      sourceLanguage: PropTypes.string.isRequired,
      targetLanguage: PropTypes.string.isRequired,
    })
  ),
};

export default SimpleTranslationHistory;
