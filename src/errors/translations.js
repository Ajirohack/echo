class TranslationError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'TranslationError';
    this.originalError = originalError;
  }
}

module.exports = { TranslationError };
