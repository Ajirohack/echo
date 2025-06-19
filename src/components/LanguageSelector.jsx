import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from '../hooks/useTranslation';
import '../styles/LanguageSelector.css';

/**
 * LanguageSelector component for selecting source and target languages
 */
export const LanguageSelector = ({
  type = 'source',
  value,
  onChange,
  disabled = false,
  excludeLanguages = [],
  className = '',
}) => {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Load languages on mount
  useEffect(() => {
    let isMounted = true;

    const loadLanguages = async () => {
      try {
        // In a real app, this would be fetched from a service
        const supportedLanguages = [
          { code: 'en', name: 'English' },
          { code: 'es', name: 'Spanish' },
          { code: 'fr', name: 'French' },
          { code: 'de', name: 'German' },
          { code: 'it', name: 'Italian' },
          { code: 'pt', name: 'Portuguese' },
          { code: 'ru', name: 'Russian' },
          { code: 'zh', name: 'Chinese' },
          { code: 'ja', name: 'Japanese' },
          { code: 'ko', name: 'Korean' },
        ];

        // Filter out excluded languages
        const filteredLanguages = supportedLanguages.filter(
          lang => !excludeLanguages.includes(lang.code)
        );

        if (isMounted) {
          setLanguages(filteredLanguages);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load languages:', err);
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    };

    loadLanguages();

    return () => {
      isMounted = false;
    };
  }, [excludeLanguages]);

  // Handle language selection
  const handleSelect = useCallback((language) => {
    if (onChange) {
      onChange(language.code);
    }
    setIsOpen(false);
    setSearchQuery('');
  }, [onChange]);

  // Filter languages based on search query
  const filteredLanguages = useCallback(() => {
    if (!searchQuery.trim()) {
      return languages;
    }
    
    const query = searchQuery.toLowerCase();
    return languages.filter(
      lang => 
        lang.name.toLowerCase().includes(query) || 
        lang.code.toLowerCase().includes(query)
    );
  }, [languages, searchQuery]);

  // Get the display name for the selected language
  const getSelectedLanguageName = useCallback(() => {
    if (!value) return t('selectLanguage');
    const lang = languages.find(l => l.code === value);
    return lang ? lang.name : value.toUpperCase();
  }, [languages, value, t]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.language-selector')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className={`language-selector loading ${className}`}>
        <span className="loading-text">{t('loading')}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`language-selector error ${className}`}>
        <span className="error-text">{t('error.loading.languages')}</span>
      </div>
    );
  }

  return (
    <div className={`language-selector ${className} ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="selector-button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${type === 'source' ? t('sourceLanguage') : t('targetLanguage')}: ${getSelectedLanguageName()}`}
      >
        <span className="selected-language">
          {getSelectedLanguageName()}
        </span>
        <span className="dropdown-arrow">▼</span>
      </button>
      
      {isOpen && (
        <div className="dropdown-menu" role="listbox">
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder={t('search.languages')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              aria-label={t('search.languages')}
            />
          </div>
          
          <div className="language-list" role="listbox">
            {filteredLanguages().length > 0 ? (
              filteredLanguages().map((language) => (
                <button
                  key={language.code}
                  type="button"
                  className={`language-option ${value === language.code ? 'selected' : ''}`}
                  onClick={() => handleSelect(language)}
                  role="option"
                  aria-selected={value === language.code}
                >
                  <span className="language-name">{language.name}</span>
                  <span className="language-code">{language.code.toUpperCase()}</span>
                </button>
              ))
            ) : (
              <div className="no-results">
                {t('noResults')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

LanguageSelector.propTypes = {
  /** Type of selector ('source' or 'target') */
  type: PropTypes.oneOf(['source', 'target']),
  /** Currently selected language code */
  value: PropTypes.string,
  /** Callback when language is selected */
  onChange: PropTypes.func.isRequired,
  /** Disable the selector */
  disabled: PropTypes.bool,
  /** Array of language codes to exclude */
  excludeLanguages: PropTypes.arrayOf(PropTypes.string),
  /** Additional CSS class */
  className: PropTypes.string,
};

// For backward compatibility
export default LanguageSelector;
