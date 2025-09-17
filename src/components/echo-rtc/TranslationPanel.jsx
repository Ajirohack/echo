import React, { useState, useEffect, useRef } from 'react';
import { useEchoRTC } from './EchoRTCProvider.jsx';
import './TranslationPanel.css';

/**
 * Translation Panel Component
 * Provides real-time translation interface and language management
 */
const TranslationPanel = ({
  translationHistory = [],
  onLanguageChange,
  showLanguageSelector = true,
  showTranslationHistory = true,
  showConfidenceScores = true,
  maxHistoryItems = 50,
  className = '',
  style = {},
}) => {
  const {
    isTranslationEnabled,
    sourceLanguage,
    targetLanguage,
    qualityMetrics,
    toggleTranslation,
    changeTranslationLanguages,
  } = useEchoRTC();

  // Local state
  const [selectedSourceLang, setSelectedSourceLang] = useState(sourceLanguage);
  const [selectedTargetLang, setSelectedTargetLang] = useState(targetLanguage);
  const [showLanguages, setShowLanguages] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [translationMode, setTranslationMode] = useState('auto'); // auto, manual, continuous
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const historyRef = useRef(null);
  const latestTranslationRef = useRef(null);

  // Supported languages
  const supportedLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
    { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'th', name: 'Thai', flag: '🇹🇭' },
  ];

  /**
   * Handle translation toggle
   */
  const handleTranslationToggle = async () => {
    try {
      await toggleTranslation(!isTranslationEnabled);
    } catch (error) {
      console.error('Failed to toggle translation:', error);
    }
  };

  /**
   * Handle language change
   */
  const handleLanguageChange = async (source, target) => {
    try {
      await changeTranslationLanguages(source, target);
      setSelectedSourceLang(source);
      setSelectedTargetLang(target);

      if (onLanguageChange) {
        onLanguageChange(source, target);
      }
    } catch (error) {
      console.error('Failed to change languages:', error);
    }
  };

  /**
   * Swap source and target languages
   */
  const swapLanguages = () => {
    const newSource = selectedTargetLang;
    const newTarget = selectedSourceLang;
    handleLanguageChange(newSource, newTarget);
  };

  /**
   * Get language by code
   */
  const getLanguageByCode = (code) => {
    return (
      supportedLanguages.find((lang) => lang.code === code) || {
        code,
        name: code.toUpperCase(),
        flag: '🌐',
      }
    );
  };

  /**
   * Filter languages based on search text
   */
  const filteredLanguages = supportedLanguages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(filterText.toLowerCase()) ||
      lang.code.toLowerCase().includes(filterText.toLowerCase())
  );

  /**
   * Get translation confidence color
   */
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return '#4CAF50'; // Green
    if (confidence >= 0.7) return '#8BC34A'; // Light Green
    if (confidence >= 0.5) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  /**
   * Get translation quality status
   */
  const getTranslationQuality = () => {
    const accuracy = qualityMetrics?.translation?.accuracy || 0;
    const speed = qualityMetrics?.translation?.speed || 0;

    if (accuracy >= 0.9 && speed >= 0.8) return { status: 'excellent', color: '#4CAF50' };
    if (accuracy >= 0.7 && speed >= 0.6) return { status: 'good', color: '#8BC34A' };
    if (accuracy >= 0.5 && speed >= 0.4) return { status: 'fair', color: '#FF9800' };
    return { status: 'poor', color: '#F44336' };
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Auto-scroll to latest translation
  useEffect(() => {
    if (latestTranslationRef.current) {
      latestTranslationRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [translationHistory]);

  // Limit history items
  const displayHistory = translationHistory.slice(-maxHistoryItems);
  const translationQuality = getTranslationQuality();
  const sourceLang = getLanguageByCode(selectedSourceLang);
  const targetLang = getLanguageByCode(selectedTargetLang);

  return (
    <div className={`translation-panel ${className}`} style={style}>
      {/* Header */}
      <div className="translation-panel__header">
        <div className="translation-panel__title">
          <h3>🌐 Translation</h3>
          <div
            className={`translation-panel__status translation-panel__status--${translationQuality.status}`}
            style={{ backgroundColor: translationQuality.color }}
            title={`Translation Quality: ${translationQuality.status}`}
          >
            {translationQuality.status}
          </div>
        </div>

        <div className="translation-panel__controls">
          <button
            className={`translation-panel__toggle ${
              isTranslationEnabled
                ? 'translation-panel__toggle--active'
                : 'translation-panel__toggle--inactive'
            }`}
            onClick={handleTranslationToggle}
            title={isTranslationEnabled ? 'Disable Translation' : 'Enable Translation'}
          >
            {isTranslationEnabled ? '🟢' : '🔴'}
          </button>

          <button
            className="translation-panel__settings-button"
            onClick={() => setShowSettings(!showSettings)}
            title="Translation Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Language Selector */}
      {showLanguageSelector && (
        <div className="translation-panel__languages">
          <div className="translation-panel__language-pair">
            <div className="translation-panel__language-selector">
              <button
                className="translation-panel__language-button"
                onClick={() => setShowLanguages(!showLanguages)}
              >
                <span className="translation-panel__language-flag">{sourceLang.flag}</span>
                <span className="translation-panel__language-name">{sourceLang.name}</span>
              </button>
            </div>

            <button
              className="translation-panel__swap-button"
              onClick={swapLanguages}
              title="Swap Languages"
            >
              ⇄
            </button>

            <div className="translation-panel__language-selector">
              <button
                className="translation-panel__language-button"
                onClick={() => setShowLanguages(!showLanguages)}
              >
                <span className="translation-panel__language-flag">{targetLang.flag}</span>
                <span className="translation-panel__language-name">{targetLang.name}</span>
              </button>
            </div>
          </div>

          {showLanguages && (
            <div className="translation-panel__language-dropdown">
              <div className="translation-panel__language-search">
                <input
                  type="text"
                  placeholder="Search languages..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="translation-panel__search-input"
                />
              </div>

              <div className="translation-panel__language-grid">
                <div className="translation-panel__language-column">
                  <h4>Source Language</h4>
                  {filteredLanguages.map((lang) => (
                    <button
                      key={`source-${lang.code}`}
                      className={`translation-panel__language-option ${
                        selectedSourceLang === lang.code
                          ? 'translation-panel__language-option--selected'
                          : ''
                      }`}
                      onClick={() => handleLanguageChange(lang.code, selectedTargetLang)}
                    >
                      <span className="translation-panel__language-flag">{lang.flag}</span>
                      <span className="translation-panel__language-name">{lang.name}</span>
                    </button>
                  ))}
                </div>

                <div className="translation-panel__language-column">
                  <h4>Target Language</h4>
                  {filteredLanguages.map((lang) => (
                    <button
                      key={`target-${lang.code}`}
                      className={`translation-panel__language-option ${
                        selectedTargetLang === lang.code
                          ? 'translation-panel__language-option--selected'
                          : ''
                      }`}
                      onClick={() => handleLanguageChange(selectedSourceLang, lang.code)}
                    >
                      <span className="translation-panel__language-flag">{lang.flag}</span>
                      <span className="translation-panel__language-name">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="translation-panel__settings">
          <div className="translation-panel__setting">
            <label>Translation Mode:</label>
            <select value={translationMode} onChange={(e) => setTranslationMode(e.target.value)}>
              <option value="auto">Automatic</option>
              <option value="manual">Manual</option>
              <option value="continuous">Continuous</option>
            </select>
          </div>

          <div className="translation-panel__setting">
            <label>Max History Items:</label>
            <input
              type="number"
              min="10"
              max="100"
              value={maxHistoryItems}
              onChange={(e) => setMaxHistoryItems(parseInt(e.target.value))}
            />
          </div>

          <div className="translation-panel__setting">
            <label>
              <input
                type="checkbox"
                checked={showConfidenceScores}
                onChange={(e) => setShowConfidenceScores(e.target.checked)}
              />
              Show Confidence Scores
            </label>
          </div>
        </div>
      )}

      {/* Translation History */}
      {showTranslationHistory && (
        <div className="translation-panel__history">
          <div className="translation-panel__history-header">
            <h4>Translation History</h4>
            <span className="translation-panel__history-count">
              {displayHistory.length} translations
            </span>
          </div>

          <div ref={historyRef} className="translation-panel__history-list">
            {displayHistory.length === 0 ? (
              <div className="translation-panel__empty-state">
                <p>No translations yet</p>
                <p>Start speaking to see translations appear here</p>
              </div>
            ) : (
              displayHistory.map((translation, index) => (
                <div
                  key={translation.id || index}
                  className="translation-panel__translation-item"
                  ref={index === displayHistory.length - 1 ? latestTranslationRef : null}
                >
                  <div className="translation-panel__translation-header">
                    <span className="translation-panel__translation-time">
                      {formatTimestamp(translation.timestamp)}
                    </span>
                    {showConfidenceScores && translation.confidence && (
                      <span
                        className="translation-panel__confidence"
                        style={{ color: getConfidenceColor(translation.confidence) }}
                        title={`Confidence: ${Math.round(translation.confidence * 100)}%`}
                      >
                        {Math.round(translation.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  <div className="translation-panel__translation-content">
                    <div className="translation-panel__original">
                      <span className="translation-panel__language-label">
                        {getLanguageByCode(translation.sourceLanguage).flag}
                      </span>
                      <span className="translation-panel__text">{translation.originalText}</span>
                    </div>

                    <div className="translation-panel__translated">
                      <span className="translation-panel__language-label">
                        {getLanguageByCode(translation.targetLanguage).flag}
                      </span>
                      <span className="translation-panel__text">{translation.translatedText}</span>
                    </div>
                  </div>

                  {translation.alternatives && translation.alternatives.length > 0 && (
                    <div className="translation-panel__alternatives">
                      <details>
                        <summary>Alternative translations</summary>
                        {translation.alternatives.map((alt, altIndex) => (
                          <div key={altIndex} className="translation-panel__alternative">
                            <span className="translation-panel__alternative-text">{alt.text}</span>
                            {showConfidenceScores && (
                              <span
                                className="translation-panel__alternative-confidence"
                                style={{ color: getConfidenceColor(alt.confidence) }}
                              >
                                {Math.round(alt.confidence * 100)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </details>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="translation-panel__stats">
        <div className="translation-panel__stat">
          <span className="translation-panel__stat-label">Accuracy:</span>
          <span className="translation-panel__stat-value">
            {Math.round((qualityMetrics?.translation?.accuracy || 0) * 100)}%
          </span>
        </div>

        <div className="translation-panel__stat">
          <span className="translation-panel__stat-label">Speed:</span>
          <span className="translation-panel__stat-value">
            {Math.round((qualityMetrics?.translation?.speed || 0) * 100)}%
          </span>
        </div>

        <div className="translation-panel__stat">
          <span className="translation-panel__stat-label">Avg Confidence:</span>
          <span className="translation-panel__stat-value">
            {Math.round((qualityMetrics?.translation?.confidence || 0) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default TranslationPanel;
