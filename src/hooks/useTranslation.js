import { useCallback } from 'react';

/**
 * Custom hook for handling translations
 * @param {Object} translations - Object containing translations
 * @returns {Function} Translation function
 */
const useTranslation = () => {
  /**
   * Translates a key to the corresponding value in the current language
   * @param {string} key - Translation key
   * @param {Object} [params] - Optional parameters for string interpolation
   * @returns {string} Translated string
   */
  const t = useCallback((key, params = {}) => {
    // Simple implementation - in a real app, this would use i18n or similar
    if (params && Object.keys(params).length > 0) {
      return Object.entries(params).reduce(
        (result, [param, value]) => result.replace(`{{${param}}}`, value),
        key
      );
    }
    return key;
  }, []);

  return { t };
};

export default useTranslation;
