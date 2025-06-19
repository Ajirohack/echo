/**
 * Capitalizes the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncates a string to a specified length and adds an ellipsis if needed
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @param {string} [ellipsis='...'] - The ellipsis string to append
 * @returns {string} The truncated string
 */
function truncate(str, maxLength, ellipsis = '...') {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + ellipsis;
}

/**
 * Safely parses a JSON string and returns the parsed object or a default value
 * @param {string} jsonString - The JSON string to parse
 * @param {*} defaultValue - The default value to return if parsing fails
 * @returns {*} The parsed object or default value
 */
function safeJsonParse(jsonString, defaultValue = {}) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

module.exports = {
  capitalize,
  truncate,
  safeJsonParse
};
