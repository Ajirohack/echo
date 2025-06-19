/**
 * Formats text for display in the UI
 * @param {string} text - The text to format
 * @param {number} [maxLength=100] - Maximum length before truncation
 * @returns {string} Formatted text
 */
function formatTextForDisplay(text, maxLength = 100) {
  if (typeof text !== 'string') return '';
  
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  
  return `${trimmed.substring(0, maxLength)}...`;
}

module.exports = { formatTextForDisplay };
