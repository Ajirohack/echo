import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../hooks/useTranslation';
import '../styles/TranslationHistory.css';

/**
 * TranslationHistory component for displaying a list of past translations
 */
export const TranslationHistory = ({
  translations = [],
  onSelect,
  onDelete,
  onClearAll,
  maxItems = 50,
  className = '',
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter and sort translations
  const filteredTranslations = useMemo(() => {
    if (!searchQuery.trim()) {
      return [...translations].slice(0, maxItems);
    }
    
    const query = searchQuery.toLowerCase();
    return translations
      .filter(trans => 
        trans.originalText?.toLowerCase().includes(query) ||
        trans.translatedText?.toLowerCase().includes(query) ||
        trans.sourceLanguage?.toLowerCase().includes(query) ||
        trans.targetLanguage?.toLowerCase().includes(query)
      )
      .slice(0, maxItems);
  }, [translations, searchQuery, maxItems]);

  // Handle translation selection
  const handleSelect = useCallback((translation) => {
    if (onSelect) {
      onSelect(translation);
    }
  }, [onSelect]);

  // Handle translation deletion
  const handleDelete = useCallback((translation, e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(translation);
    }
  }, [onDelete]);

  // Handle clear all translations
  const handleClearAll = useCallback(() => {
    if (onClearAll) {
      if (showDeleteConfirm) {
        onClearAll();
        setShowDeleteConfirm(false);
      } else {
        setShowDeleteConfirm(true);
        // Reset confirmation after 3 seconds
        setTimeout(() => setShowDeleteConfirm(false), 3000);
      }
    }
  }, [onClearAll, showDeleteConfirm]);

  // Format timestamp to relative time (e.g., "2 minutes ago")
  const formatTimeAgo = useCallback((timestamp) => {
    if (!timestamp) return '';
    
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return interval === 1 
          ? t(`time.${unit}Ago`, { count: interval })
          : t(`time.${unit}sAgo`, { count: interval });
      }
    }
    
    return t('time.justNow');
  }, [t]);

  // Get language name from code
  const getLanguageName = useCallback((code) => {
    const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
    try {
      return languageNames.of(code) || code.toUpperCase();
    } catch (e) {
      return code.toUpperCase();
    }
  }, []);

  return (
    <div className={`translation-history ${className}`}>
      <div className="history-header">
        <h3 className="history-title">{t('translationHistory')}</h3>
        
        {translations.length > 0 && (
          <div className="history-actions">
            <button
              type="button"
              className="clear-button"
              onClick={handleClearAll}
              title={t('clearAll')}
              aria-label={t('clearAll')}
            >
              {showDeleteConfirm ? t('confirmClear') : t('clearAll')}
            </button>
          </div>
        )}
      </div>
      
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder={t('searchHistory')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('searchHistory')}
        />
      </div>
      
      {filteredTranslations.length > 0 ? (
        <ul className="translation-list" role="list">
          {filteredTranslations.map((translation, index) => (
            <li 
              key={`${translation.id || index}-${translation.timestamp}`}
              className="translation-item"
              onClick={() => handleSelect(translation)}
              role="listitem"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(translation)}
            >
              <div className="translation-content">
                <div className="translation-original">
                  <span className="language-badge" title={getLanguageName(translation.sourceLanguage)}>
                    {translation.sourceLanguage?.toUpperCase()}
                  </span>
                  <p>{translation.originalText}</p>
                </div>
                <div className="translation-result">
                  <span className="language-badge" title={getLanguageName(translation.targetLanguage)}>
                    {translation.targetLanguage?.toUpperCase()}
                  </span>
                  <p>{translation.translatedText}</p>
                </div>
                <div className="translation-meta">
                  <span className="timestamp">
                    {formatTimeAgo(translation.timestamp)}
                  </span>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={(e) => handleDelete(translation, e)}
                    aria-label={t('delete')}
                    title={t('delete')}
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          {searchQuery ? (
            <p>{t('noMatchingTranslations')}</p>
          ) : (
            <p>{t('noTranslationHistory')}</p>
          )}
        </div>
      )}
    </div>
  );
};

TranslationHistory.propTypes = {
  /** Array of translation objects */
  translations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      originalText: PropTypes.string.isRequired,
      translatedText: PropTypes.string.isRequired,
      sourceLanguage: PropTypes.string.isRequired,
      targetLanguage: PropTypes.string.isRequired,
      timestamp: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
        PropTypes.instanceOf(Date)
      ]).isRequired,
    })
  ),
  /** Callback when a translation is selected */
  onSelect: PropTypes.func,
  /** Callback when a translation is deleted */
  onDelete: PropTypes.func,
  /** Callback when clear all button is clicked */
  onClearAll: PropTypes.func,
  /** Maximum number of items to display */
  maxItems: PropTypes.number,
  /** Additional CSS class */
  className: PropTypes.string,
};

// For backward compatibility
export default TranslationHistory;
