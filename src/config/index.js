const path = require('path');
const fs = require('fs').promises;

function getProjectRoot() {
  // src/config => project root is two levels up
  return path.resolve(__dirname, '..', '..');
}

function getConfigDirectory() {
  return path.join(getProjectRoot(), 'config');
}

async function safeReadJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(data);
    if (json && typeof json === 'object') return json;
    return null;
  } catch (_) {
    return null;
  }
}

async function loadTranslationConfig() {
  const p = path.join(getConfigDirectory(), 'translation-config.json');
  const cfg = await safeReadJson(p);
  // Minimal shape normalization
  if (cfg && typeof cfg === 'object') return cfg;
  return null;
}

async function loadTTSConfig() {
  const p = path.join(getConfigDirectory(), 'tts-config.json');
  const cfg = await safeReadJson(p);
  if (cfg && typeof cfg === 'object') return cfg;
  return null;
}

async function loadAIProviders() {
  const p = path.join(getConfigDirectory(), 'ai-providers.json');
  const cfg = await safeReadJson(p);
  if (cfg && typeof cfg === 'object') return cfg;
  return null;
}

module.exports = {
  getConfigDirectory,
  loadTranslationConfig,
  loadTTSConfig,
  loadAIProviders,
};
