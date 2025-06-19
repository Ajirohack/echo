// filepath: /Volumes/Project Disk/Multi-Platform Translation APP/translation-app/renderer.js
// DOM Elements
const recordButton = document.getElementById('recordButton');
const stopButton = document.getElementById('stopButton');
const settingsButton = document.getElementById('settingsButton');
const sourceText = document.getElementById('sourceText');
const translatedText = document.getElementById('translatedText');
const recordingIndicator = document.getElementById('recordingIndicator');
const statusMessage = document.getElementById('statusMessage');
const playTranslation = document.getElementById('playTranslation');
const settingsModal = document.getElementById('settingsModal');
const closeModalButtons = document.querySelectorAll('.close-modal');
const saveSettingsButton = document.getElementById('saveSettings');
const swapLanguagesButton = document.getElementById('swapLanguages');
const translateButton = document.getElementById('translateButton');
const translationDisplay = document.getElementById('translationDisplay');
const translationMetrics = document.getElementById('translationMetrics');

// State
let isRecording = false;
let isTranslationActive = false;
let translationPipeline = null;
let realTimeProcessor = null;
let currentTranslations = [];

// Complete Pipeline integration
let completePipeline = null;
let isCompletePipelineActive = false;
let currentVoices = {};
let audioPlaybackStore = new Map();

// Initialize the application
function initApp() {
    updateStatus('Ready to start');
    loadSettings();
    setupEventListeners();
    initializeTranslationSystem();
}

// Set up event listeners
function setupEventListeners() {
    // Recording controls
    recordButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);

    // Settings
    settingsButton.addEventListener('click', () => toggleModal(true));
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => toggleModal(false));
    });
    saveSettingsButton.addEventListener('click', saveSettings);

    // Language swapping
    swapLanguagesButton.addEventListener('click', swapLanguages);

    // Play translation audio
    playTranslation.addEventListener('click', playTranslatedAudio);

    // Translation controls
    if (translateButton) {
        translateButton.addEventListener('click', toggleTranslation);
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            toggleModal(false);
        }
    });
}

// Toggle settings modal
function toggleModal(show) {
    if (show) {
        settingsModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    } else {
        settingsModal.classList.remove('active');
        document.body.style.overflow = ''; // Re-enable scrolling
    }
}

// Start recording
async function startRecording() {
    try {
        updateStatus('Starting recording...');

        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Update UI
        isRecording = true;
        recordButton.disabled = true;
        stopButton.disabled = false;
        recordingIndicator.style.display = 'flex';

        // Clear previous text
        sourceText.textContent = 'Listening...';
        translatedText.textContent = 'Translation will appear here...';

        // Start the complete pipeline if initialized
        if (completePipeline && !isCompletePipelineActive) {
            try {
                const sourceLang = document.getElementById('sourceLanguageComplete')?.value || 'auto';
                const targetLang = document.getElementById('targetLanguageComplete')?.value || 'en';

                // Set languages
                completePipeline.setLanguages(sourceLang, targetLang);

                // Activate the pipeline
                await completePipeline.activate();
                isCompletePipelineActive = true;

                // Update UI
                const pipelineBtn = document.getElementById('completePipelineButton');
                if (pipelineBtn) {
                    pipelineBtn.textContent = 'Stop Complete Pipeline';
                    pipelineBtn.classList.add('btn-stop');
                }

                updateStatus('Complete pipeline activated');
            } catch (error) {
                console.error('Failed to activate complete pipeline:', error);
            }
        }

        // If we have an initialized real-time processor, use it
        if (realTimeProcessor && realTimeProcessor.isInitialized) {
            const sourceLang = document.getElementById('sourceLang')?.value || 'auto';
            const targetLang = document.getElementById('targetLang')?.value || 'en';

            try {
                await realTimeProcessor.start({
                    sourceLanguage: sourceLang,
                    targetLanguage: targetLang
                });

                isTranslationActive = true;
                updateStatus('Real-time translation started');
            } catch (error) {
                console.error('Failed to start real-time processing:', error);

                // Fall back to demo mode
                simulateDemoTranslation();
            }
        } else {
            // For demo purposes, simulate speech recognition and translation
            simulateDemoTranslation();
        }

    } catch (error) {
        console.error('Error accessing microphone:', error);
        updateStatus(`Error: ${error.message}`, 'error');
        isRecording = false;
        recordButton.disabled = false;
        stopButton.disabled = true;
        recordingIndicator.style.display = 'none';
    }
}

// Simulate demo translation for development
function simulateDemoTranslation() {
    updateStatus('Demo mode: Recording in progress...');

    setTimeout(() => {
        if (isRecording) {
            const demoText = "This is a demonstration of the translation app. The actual implementation will process real-time audio.";
            updateSourceText(demoText);

            // Simulate translation
            setTimeout(() => {
                updateTranslatedText("Esta es una demostración de la aplicación de traducción. La implementación real procesará audio en tiempo real.");
            }, 1000);
        }
    }, 2000);
}

// Stop recording
function stopRecording() {
    isRecording = false;
    recordButton.disabled = false;
    stopButton.disabled = true;
    recordingIndicator.style.display = 'none';

    // Stop real-time processor if active
    if (realTimeProcessor && isTranslationActive) {
        realTimeProcessor.stop().catch(error => {
            console.error('Error stopping real-time processor:', error);
        });

        isTranslationActive = false;
    }

    // Stop complete pipeline if active
    if (completePipeline && isCompletePipelineActive) {
        completePipeline.deactivate().catch(error => {
            console.error('Error deactivating complete pipeline:', error);
        });

        isCompletePipelineActive = false;

        // Update UI
        const pipelineBtn = document.getElementById('completePipelineButton');
        if (pipelineBtn) {
            pipelineBtn.textContent = 'Start Complete Pipeline';
            pipelineBtn.classList.remove('btn-stop');
        }
    }

    updateStatus('Recording stopped');

    // Reset UI if no text was captured
    if (sourceText.textContent === 'Listening...') {
        sourceText.textContent = 'Speak or type text here...';
    }
}

// Update source text with animation
function updateSourceText(text) {
    sourceText.textContent = text;
    sourceText.classList.add('highlight-update');
    setTimeout(() => {
        sourceText.classList.remove('highlight-update');
    }, 1500);
}

// Update translated text with animation
function updateTranslatedText(text) {
    translatedText.textContent = text;
    translatedText.classList.add('highlight-update');
    setTimeout(() => {
        translatedText.classList.remove('highlight-update');
    }, 1500);
}

// Play translated audio
function playTranslatedAudio() {
    if (translatedText.textContent && translatedText.textContent !== 'Translation will appear here...') {
        // TODO: Implement actual TTS playback
        updateStatus('Playing translation...');

        // For demo, just show a brief status update
        setTimeout(() => {
            updateStatus('Translation played');
        }, 1000);
    }
}

// Swap source and target languages
function swapLanguages() {
    const sourceLang = document.getElementById('sourceLang');
    const targetLang = document.getElementById('targetLang');

    if (sourceLang && targetLang) {
        // Only swap if source is not 'auto'
        if (sourceLang.value !== 'auto') {
            const temp = sourceLang.value;
            sourceLang.value = targetLang.value;
            targetLang.value = temp;

            // Also swap the text if we have content
            if (sourceText.textContent && sourceText.textContent !== 'Speak or type text here...' &&
                translatedText.textContent && translatedText.textContent !== 'Translation will appear here...') {
                const tempText = sourceText.textContent;
                updateSourceText(translatedText.textContent);
                updateTranslatedText(tempText);
            }

            // If translation pipeline is active, update it
            if (translationPipeline && translationPipeline.isInitialized) {
                translationPipeline.swapLanguages();
            }

            updateStatus('Languages swapped');
        }
    }
}

// Load settings from storage
function loadSettings() {
    // TODO: Load actual settings from storage
    const defaultSettings = {
        inputDevice: 'default',
        outputDevice: 'default',
        translationService: 'google',
        googleApiKey: '',
        deeplApiKey: '',
        azureKey: '',
        azureRegion: ''
    };

    // Apply settings to UI
    const inputDeviceElement = document.getElementById('inputDevice');
    if (inputDeviceElement) inputDeviceElement.value = defaultSettings.inputDevice;

    const outputDeviceElement = document.getElementById('outputDevice');
    if (outputDeviceElement) outputDeviceElement.value = defaultSettings.outputDevice;

    const translationServiceElement = document.getElementById('translationService');
    if (translationServiceElement) translationServiceElement.value = defaultSettings.translationService;

    const googleApiKeyElement = document.getElementById('googleApiKey');
    if (googleApiKeyElement) googleApiKeyElement.value = defaultSettings.googleApiKey;

    const deeplApiKeyElement = document.getElementById('deeplApiKey');
    if (deeplApiKeyElement) deeplApiKeyElement.value = defaultSettings.deeplApiKey;

    const azureKeyElement = document.getElementById('azureKey');
    if (azureKeyElement) azureKeyElement.value = defaultSettings.azureKey;

    const azureRegionElement = document.getElementById('azureRegion');
    if (azureRegionElement) azureRegionElement.value = defaultSettings.azureRegion;

    // TODO: Load audio devices
    updateAudioDevices();
}

// Save settings to storage
async function saveSettings() {
    const settings = {
        inputDevice: document.getElementById('inputDevice')?.value || 'default',
        outputDevice: document.getElementById('outputDevice')?.value || 'default',
        translationService: document.getElementById('translationService')?.value || 'google',
        googleApiKey: document.getElementById('googleApiKey')?.value || '',
        deeplApiKey: document.getElementById('deeplApiKey')?.value || '',
        azureKey: document.getElementById('azureKey')?.value || '',
        azureRegion: document.getElementById('azureRegion')?.value || ''
    };

    // TODO: Save settings to secure storage
    console.log('Saving settings:', settings);

    // Show success message
    updateStatus('Settings saved successfully');

    // Close the modal after a short delay
    setTimeout(() => {
        toggleModal(false);
    }, 1000);
}

// Update audio device lists
async function updateAudioDevices() {
    try {
        // Get available audio devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();

        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

        // Update input devices
        const inputSelect = document.getElementById('inputDevice');
        if (inputSelect) {
            inputSelect.innerHTML = '';

            audioInputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microphone ${inputSelect.length + 1}`;
                inputSelect.appendChild(option);
            });
        }

        // Update output devices
        const outputSelect = document.getElementById('outputDevice');
        if (outputSelect) {
            outputSelect.innerHTML = '';

            audioOutputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Speaker ${outputSelect.length + 1}`;
                outputSelect.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Error accessing audio devices:', error);
    }
}

// Update status message
function updateStatus(message, type = 'info') {
    statusMessage.textContent = message;

    // Clear any previous status classes
    statusMessage.className = 'status-message';

    // Add appropriate class based on message type
    if (type === 'error') {
        statusMessage.classList.add('error');
    } else if (type === 'success') {
        statusMessage.classList.add('success');
    } else if (type === 'warning') {
        statusMessage.classList.add('warning');
    }
}

// Initialize translation pipeline
async function initializeTranslationSystem() {
    try {
        updateStatus('Initializing translation system...');

        // Import the real-time processor
        const RealTimeProcessor = require('./src/core/real-time-processor');

        // Import the complete pipeline
        const CompletePipeline = require('./src/core/complete-pipeline');

        // Create and initialize the processor
        realTimeProcessor = new RealTimeProcessor();
        await realTimeProcessor.initialize();

        // Get the translation pipeline from the processor
        translationPipeline = realTimeProcessor.translationPipeline;

        // Initialize the complete pipeline with TTS integration
        completePipeline = new CompletePipeline({
            enableSTT: true,
            enableTranslation: true,
            enableTTS: true,
            autoLanguageDetection: true,
            sourceLanguage: document.getElementById('sourceLang').value,
            targetLanguage: document.getElementById('targetLang').value
        });

        // Initialize the complete pipeline
        await completePipeline.initialize();

        // Set up event listeners for both systems
        setupTranslationEventListeners();
        setupCompletePipelineEventListeners();

        // Get supported language pairs and update UI
        const languagePairs = await translationPipeline.getSupportedLanguagePairs();
        updateSupportedLanguagePairs(languagePairs);

        updateStatus('Translation system initialized successfully');

    } catch (error) {
        console.error('Translation system initialization failed:', error);
        updateStatus('Translation initialization failed: ' + error.message, 'error');
    }
}

// Setup translation event listeners
function setupTranslationEventListeners() {
    if (!realTimeProcessor || !translationPipeline) return;

    realTimeProcessor.on('realTimeResult', handleRealTimeResult);
    realTimeProcessor.on('processorError', handleProcessorError);
    realTimeProcessor.on('languagesChanged', handleLanguagesChanged);
    realTimeProcessor.on('processorStarted', handleProcessorStarted);
    realTimeProcessor.on('processorStopped', handleProcessorStopped);

    translationPipeline.on('pipelineResult', handlePipelineResult);
    translationPipeline.on('pipelineError', handlePipelineError);
}

// Handle real-time processor results
function handleRealTimeResult(data) {
    console.log('Real-time result:', data);
    addCompleteTranslationToUI(data);
    updateMetricsDisplay();
}

// Handle processor errors
function handleProcessorError(error) {
    console.error('Processor error:', error);
    updateStatus(`Translation error (${error.stage}): ${error.error}`, 'error');
    addErrorToTranslationUI(error);
}

// Handle pipeline results
function handlePipelineResult(data) {
    console.log('Pipeline result:', data);

    switch (data.type) {
        case 'complete':
            addCompleteTranslationToUI(data.result);
            break;
        case 'translation':
            addTranslationOnlyToUI(data.result);
            break;
    }

    // Update metrics display
    updateMetricsDisplay();
}

// Handle pipeline errors
function handlePipelineError(error) {
    console.error('Pipeline error:', error);
    updateStatus(`Translation error (${error.stage}): ${error.error}`, 'error');
    addErrorToTranslationUI(error);
}

// Add complete translation to UI
function addCompleteTranslationToUI(result) {
    if (!translationDisplay) return;

    const container = translationDisplay;

    const translationElement = document.createElement('div');
    translationElement.className = `translation-complete ${result.source || 'microphone'}`;

    translationElement.innerHTML = `
        <div class="translation-header">
            <span class="translation-direction">${result.fromLanguage} → ${result.toLanguage}</span>
            <span class="translation-service">${result.services?.translation || result.service || 'Unknown'}</span>
        </div>
        <div class="original-text">${result.original || result.text}</div>
        <div class="translated-text">${result.translated || result.translation}</div>
        <div class="translation-footer">
            <span class="translation-confidence">Confidence: ${Math.round((result.confidence?.translation || result.confidence || 0.8) * 100)}%</span>
            ${result.processingTime ? `<span class="translation-time">${result.processingTime.total || result.processingTime}ms</span>` : ''}
        </div>
    `;

    container.appendChild(translationElement);
    container.scrollTop = container.scrollHeight;

    // Store translation
    currentTranslations.push(result);

    // Limit stored translations
    if (currentTranslations.length > 50) {
        currentTranslations = currentTranslations.slice(-50);
    }

    // Update the main text areas too
    if (sourceText && translatedText) {
        sourceText.textContent = result.original || result.text;
        translatedText.textContent = result.translated || result.translation;
    }
}

// Add translation-only result to UI
function addTranslationOnlyToUI(result) {
    if (!translationDisplay) return;

    const container = translationDisplay;

    const translationElement = document.createElement('div');
    translationElement.className = 'translation-only';

    translationElement.innerHTML = `
        <div class="translation-header">
            <span class="translation-direction">${result.fromLanguage} → ${result.toLanguage}</span>
            <span class="translation-service">${result.service || 'Unknown'}</span>
        </div>
        <div class="translated-text">${result.translation}</div>
        <div class="translation-footer">
            <span class="translation-confidence">Confidence: ${Math.round((result.confidence || 0.8) * 100)}%</span>
            ${result.processingTime ? `<span class="translation-time">${result.processingTime}ms</span>` : ''}
        </div>
    `;

    container.appendChild(translationElement);
    container.scrollTop = container.scrollHeight;

    // Update translated text area
    if (translatedText) {
        translatedText.textContent = result.translation;
    }
}

// Add error to translation UI
function addErrorToTranslationUI(error) {
    if (!translationDisplay) return;

    const container = translationDisplay;

    const errorElement = document.createElement('div');
    errorElement.className = 'translation-error';

    errorElement.innerHTML = `
        <div class="error-header">
            <span class="error-stage">${error.stage || 'Error'}</span>
        </div>
        <div class="error-message">${error.error || error.message || 'Unknown error'}</div>
    `;

    container.appendChild(errorElement);
    container.scrollTop = container.scrollHeight;

    // Auto-remove error after 10 seconds
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.classList.add('fade-out');
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.parentNode.removeChild(errorElement);
                }
            }, 500);
        }
    }, 10000);
}

// Update supported language pairs
function updateSupportedLanguagePairs(languagePairs) {
    console.log(`Translation system supports ${languagePairs.length} language pairs`);

    // Update language selectors
    updateLanguageSelectors(languagePairs);
}

// Update language selectors
function updateLanguageSelectors(languagePairs) {
    const sourceSelect = document.getElementById('sourceLang');
    const targetSelect = document.getElementById('targetLang');

    if (!sourceSelect || !targetSelect) return;

    // Extract unique languages from pairs
    const languages = new Set();
    languagePairs.forEach(pair => {
        const [from, to] = pair.split('-');
        languages.add(from);
        languages.add(to);
    });

    const sortedLanguages = Array.from(languages).sort();

    // Update source language selector
    sourceSelect.innerHTML = '<option value="auto">Auto-Detect</option>';
    sortedLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = getLanguageName(lang);
        sourceSelect.appendChild(option);
    });

    // Update target language selector
    targetSelect.innerHTML = '';
    sortedLanguages.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = getLanguageName(lang);
        targetSelect.appendChild(option);
    });
}

// Get language name from code
function getLanguageName(code) {
    const languageNames = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'bn': 'Bengali',
        'id': 'Indonesian',
        'tr': 'Turkish',
        'nl': 'Dutch',
        'sv': 'Swedish',
        'fi': 'Finnish',
        'da': 'Danish',
        'no': 'Norwegian',
        'pl': 'Polish',
        'cs': 'Czech',
        'sk': 'Slovak',
        'uk': 'Ukrainian',
        'el': 'Greek',
        'th': 'Thai',
        'vi': 'Vietnamese'
    };

    return languageNames[code] || code.toUpperCase();
}

// Start/Stop translation
async function toggleTranslation() {
    if (!realTimeProcessor) {
        updateStatus('Translation system not initialized', 'error');
        return;
    }

    const translateBtn = document.getElementById('translateButton');
    if (!translateBtn) return;

    try {
        if (!isTranslationActive) {
            updateStatus('Starting translation...');

            // Set languages from UI
            const sourceLang = document.getElementById('sourceLang')?.value || 'auto';
            const targetLang = document.getElementById('targetLang')?.value || 'en';

            // Start the processor
            await realTimeProcessor.start({
                sourceLanguage: sourceLang,
                targetLanguage: targetLang
            });

            isTranslationActive = true;
            translateBtn.textContent = 'Stop Translation';
            translateBtn.classList.add('btn-stop');

            updateStatus('Translation active');
        } else {
            updateStatus('Stopping translation...');

            // Stop the processor
            await realTimeProcessor.stop();

            isTranslationActive = false;
            translateBtn.textContent = 'Start Translation';
            translateBtn.classList.remove('btn-stop');

            updateStatus('Translation stopped');
        }

    } catch (error) {
        console.error('Translation toggle failed:', error);
        updateStatus('Translation toggle failed: ' + error.message, 'error');
    }
}

// Handle processor started event
function handleProcessorStarted(data) {
    updateStatus(`Translation started (Session: ${data.sessionId.substr(0, 8)})`);
}

// Handle processor stopped event
function handleProcessorStopped(data) {
    updateStatus(`Translation stopped (Duration: ${Math.round(data.duration / 1000)}s)`);
}

// Handle languages changed event
function handleLanguagesChanged(data) {
    updateStatus(`Languages changed: ${data.sourceLanguage} → ${data.targetLanguage}`);

    // Update language selectors if they exist
    const sourceSelect = document.getElementById('sourceLang');
    const targetSelect = document.getElementById('targetLang');

    if (sourceSelect && targetSelect) {
        sourceSelect.value = data.sourceLanguage;
        targetSelect.value = data.targetLanguage;
    }
}

// Process text directly (without audio)
async function processTextDirect() {
    if (!translationPipeline) {
        updateStatus('Translation system not initialized', 'error');
        return;
    }

    const textToTranslate = sourceText.textContent;
    if (!textToTranslate || textToTranslate === 'Speak or type text here...') {
        updateStatus('No text to translate', 'warning');
        return;
    }

    try {
        updateStatus('Translating text...');

        const sourceLang = document.getElementById('sourceLang')?.value || 'auto';
        const targetLang = document.getElementById('targetLang')?.value || 'en';

        const result = await translationPipeline.processTextDirect(
            textToTranslate,
            sourceLang,
            targetLang
        );

        if (result.success) {
            updateTranslatedText(result.translation);
            updateStatus('Text translated successfully');

            // Add to translation display
            addCompleteTranslationToUI({
                original: textToTranslate,
                translated: result.translation,
                fromLanguage: result.fromLanguage || sourceLang,
                toLanguage: result.toLanguage || targetLang,
                service: result.service,
                confidence: result.confidence,
                processingTime: result.processingTime
            });
        } else {
            updateStatus(`Translation failed: ${result.error}`, 'error');
        }

    } catch (error) {
        console.error('Text translation failed:', error);
        updateStatus('Text translation failed: ' + error.message, 'error');
    }
}

// Update metrics display
function updateMetricsDisplay() {
    if (!translationMetrics || !realTimeProcessor) return;

    const metrics = realTimeProcessor.getStatus();

    translationMetrics.innerHTML = `
        <div class="metrics-item">
            <span class="metric-label">Latency:</span>
            <span class="metric-value">${Math.round(metrics.metrics.averageLatency)}ms</span>
        </div>
        <div class="metrics-item">
            <span class="metric-label">Translations:</span>
            <span class="metric-value">${metrics.session?.segments || 0}</span>
        </div>
        <div class="metrics-item">
            <span class="metric-label">Success Rate:</span>
            <span class="metric-value">${Math.round(metrics.components?.pipeline?.metrics?.successRate * 100 || 100)}%</span>
        </div>
    `;
}

// Clear translation history
function clearTranslationHistory() {
    if (!translationDisplay) return;

    translationDisplay.innerHTML = '<div class="translation-placeholder">Translations will appear here...</div>';
    currentTranslations = [];
    updateStatus('Translation history cleared');
}

// Export translation history
function exportTranslationHistory() {
    if (!realTimeProcessor) {
        updateStatus('Translation system not available', 'error');
        return;
    }

    try {
        const exportData = realTimeProcessor.exportSessionData();

        // Create downloadable file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `translation-history-${new Date().toISOString().slice(0, 10)}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        updateStatus('Translation history exported');

    } catch (error) {
        console.error('Export failed:', error);
        updateStatus('Export failed: ' + error.message, 'error');
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);

// Setup complete pipeline event listeners
function setupCompletePipelineEventListeners() {
    if (!completePipeline) return;

    completePipeline.on('initialized', handleCompletePipelineInitialized);
    completePipeline.on('pipelineResult', handleCompletePipelineResult);
    completePipeline.on('error', handleCompletePipelineError);
    completePipeline.on('activated', handleCompletePipelineActivated);
    completePipeline.on('deactivated', handleCompletePipelineDeactivated);
    completePipeline.on('languagesChanged', handleCompletePipelineLanguagesChanged);
    completePipeline.on('voiceChanged', handleVoiceChanged);

    console.log('Complete pipeline event listeners set up');
}

// Handle complete pipeline initialization
function handleCompletePipelineInitialized(data) {
    updateStatus(`Complete pipeline initialized (${data.sourceLanguage} → ${data.targetLanguage})`);

    // Add controls for complete pipeline to UI
    if (!document.getElementById('completePipelineControls')) {
        createCompletePipelineUI();
    }

    // Update language selectors with supported languages
    updateLanguageSelectors();

    // Get available voices for the target language
    updateVoiceSelectors();
}

// Handle complete pipeline results
function handleCompletePipelineResult(result) {
    console.log('Complete pipeline result:', result);

    // Add result to UI
    addCompletePipelineResultToUI(result);

    // Update metrics
    updateCompletePipelineMetrics();

    // Store audio for playback if available
    if (result.tts && result.tts.audioAvailable) {
        storeAudioForPlayback(result.id, result.tts.audio || result.tts.audioData);
    }
}

// Add complete pipeline result to UI
function addCompletePipelineResultToUI(result) {
    const container = document.getElementById('completePipelineDisplay');
    if (!container) return;

    const resultElement = document.createElement('div');
    resultElement.className = 'complete-pipeline-result';
    resultElement.dataset.id = result.id;

    // Create result content with timing information
    resultElement.innerHTML = `
        <div class="pipeline-header">
            <span class="source-info">${result.original.language.toUpperCase()} → ${result.translation.language.toUpperCase()}</span>
            ${result.tts ? `<span class="voice-info">${result.tts.voiceName || 'System Voice'}</span>` : ''}
            <span class="timestamp">${new Date(result.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="pipeline-content">
            <div class="original-section">
                <div class="section-label">Original (${result.original.language}):</div>
                <div class="section-text">${result.original.text}</div>
                <div class="section-meta">Confidence: ${(result.original.confidence * 100).toFixed(1)}%</div>
            </div>
            <div class="translation-section">
                <div class="section-label">Translation (${result.translation.language}):</div>
                <div class="section-text">${result.translation.text}</div>
                <div class="section-meta">Confidence: ${(result.translation.confidence * 100).toFixed(1)}%</div>
            </div>
            ${result.tts && result.tts.audioAvailable ? `
                <div class="audio-controls">
                    <button class="play-audio-btn" onclick="playResultAudio('${result.id}')">
                        Play Audio (${result.tts.voiceName})
                    </button>
                </div>
            ` : ''}
            <div class="pipeline-timing">
                <div class="timing-label">Processing Time: ${result.processingTime.total.toFixed(0)}ms</div>
                <div class="timing-breakdown">
                    <span class="timing-item">STT: ${result.processingTime.stt.toFixed(0)}ms</span>
                    <span class="timing-item">Translation: ${result.processingTime.translation.toFixed(0)}ms</span>
                    ${result.processingTime.tts ? `<span class="timing-item">TTS: ${result.processingTime.tts.toFixed(0)}ms</span>` : ''}
                </div>
            </div>
        </div>
    `;

    // Add to container (at the top)
    container.insertBefore(resultElement, container.firstChild);

    // Limit the number of displayed results (keep last 10)
    const results = container.querySelectorAll('.complete-pipeline-result');
    if (results.length > 10) {
        container.removeChild(results[results.length - 1]);
    }
}

// Handle complete pipeline errors
function handleCompletePipelineError(error) {
    console.error('Complete pipeline error:', error);
    updateStatus(`Error: ${error.message}`, 'error');

    // Add error to UI
    addErrorToPipelineUI(error);
}

// Add error to pipeline UI
function addErrorToPipelineUI(error) {
    const container = document.getElementById('completePipelineDisplay');
    if (!container) return;

    const errorElement = document.createElement('div');
    errorElement.className = 'pipeline-error';

    errorElement.innerHTML = `
        <div class="error-header">
            <span class="error-icon">⚠️</span>
            <span class="error-stage">Error in ${error.stage || 'pipeline'}</span>
        </div>
        <div class="error-message">${error.message}</div>
    `;

    container.insertBefore(errorElement, container.firstChild);

    // Auto-remove after 15 seconds
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }, 15000);
}

// Handle voice change
function handleVoiceChanged(data) {
    updateStatus(`Voice changed to: ${data.voice} for ${data.language}`);
    updateVoiceSelectors();
}

// Update complete pipeline metrics
function updateCompletePipelineMetrics() {
    if (!completePipeline) return;

    const metrics = completePipeline.getStatus().metrics;
    const metricsContainer = document.getElementById('pipelineMetrics');

    if (metricsContainer) {
        metricsContainer.innerHTML = `
            <div class="metric-item">
                <span class="metric-label">Total Processed:</span>
                <span class="metric-value">${metrics.totalProcessed}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Success Rate:</span>
                <span class="metric-value">${(metrics.successRate * 100).toFixed(1)}%</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Avg. Latency:</span>
                <span class="metric-value">${metrics.averageLatency.toFixed(0)}ms</span>
            </div>
            <div class="error-counts">
                <span class="error-item">STT Errors: ${metrics.errors?.stt || 0}</span>
                <span class="error-item">Translation Errors: ${metrics.errors?.translation || 0}</span>
                <span class="error-item">TTS Errors: ${metrics.errors?.tts || 0}</span>
            </div>
        `;
    }
}

// Store audio data for playback
function storeAudioForPlayback(id, audioData) {
    // Convert audio data to playable format
    if (!audioData) return;

    try {
        // Convert audio buffer to base64 URL for playback
        const blob = new Blob([audioData], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        audioPlaybackStore.set(id, url);
    } catch (error) {
        console.error('Error storing audio for playback:', error);
    }
}

// Play result audio
function playResultAudio(id) {
    const audioUrl = audioPlaybackStore.get(id);
    if (!audioUrl) {
        console.error('No audio available for playback with ID:', id);
        return;
    }

    // Play the audio
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
        console.error('Error playing audio:', error);
    });
}

// Start/Stop complete pipeline
async function toggleCompletePipeline() {
    const pipelineBtn = document.getElementById('completePipelineButton');

    if (!completePipeline) {
        updateStatus('Complete pipeline not initialized', 'error');
        return;
    }

    if (isCompletePipelineActive) {
        // Stop the pipeline
        await completePipeline.deactivate();
        isCompletePipelineActive = false;
        pipelineBtn.textContent = 'Start Complete Pipeline';
        pipelineBtn.classList.remove('btn-stop');
        updateStatus('Complete pipeline stopped');
    } else {
        // Start the pipeline
        try {
            // Get source and target languages
            const sourceLang = document.getElementById('sourceLanguageComplete').value;
            const targetLang = document.getElementById('targetLanguageComplete').value;

            // Set languages
            completePipeline.setLanguages(sourceLang, targetLang);

            // Set voice if selected
            const selectedVoice = document.getElementById('voiceSelector').value;
            if (selectedVoice && selectedVoice !== 'auto') {
                completePipeline.setVoice(selectedVoice);
            }

            // Activate the pipeline
            await completePipeline.activate();

            isCompletePipelineActive = true;
            pipelineBtn.textContent = 'Stop Complete Pipeline';
            pipelineBtn.classList.add('btn-stop');
            updateStatus('Complete pipeline started');
        } catch (error) {
            console.error('Failed to start complete pipeline:', error);
            updateStatus(`Error: ${error.message}`, 'error');
        }
    }
}

// Test complete pipeline
async function testCompletePipeline() {
    if (!completePipeline) {
        updateStatus('Complete pipeline not initialized', 'error');
        return;
    }

    try {
        updateStatus('Testing complete pipeline...');

        // Run test with default text
        await completePipeline.testPipeline();

        updateStatus('Complete pipeline test completed');
    } catch (error) {
        console.error('Complete pipeline test failed:', error);
        updateStatus(`Test error: ${error.message}`, 'error');
    }
}

// Test selected voice
async function testSelectedVoice() {
    if (!completePipeline || !completePipeline.ttsManager) {
        updateStatus('TTS not initialized', 'error');
        return;
    }

    try {
        updateStatus('Testing voice...');

        const voice = document.getElementById('voiceSelector').value;
        const targetLang = document.getElementById('targetLanguageComplete').value;

        // Set voice first
        completePipeline.setVoice(voice);

        // Generate test text based on language
        const testText = "This is a test of the selected voice. How does it sound?";

        // Use TTS directly
        const ttsResult = await completePipeline.ttsManager.synthesize(
            testText,
            targetLang,
            { voice }
        );

        // Play the audio
        await playAudioData(ttsResult.audio);

        updateStatus('Voice test completed');
    } catch (error) {
        console.error('Voice test failed:', error);
        updateStatus(`Voice test error: ${error.message}`, 'error');
    }
}

// Play audio data directly
function playAudioData(audioData) {
    try {
        // Create audio element and play
        const blob = new Blob([audioData], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        return audio.play();
    } catch (error) {
        console.error('Error playing audio data:', error);
        throw error;
    }
}

// Update available voices
function updateVoiceSelectors() {
    if (!completePipeline || !completePipeline.ttsManager) return;

    const targetLang = document.getElementById('targetLanguageComplete')?.value || 'en';
    const voiceSelector = document.getElementById('voiceSelector');

    if (!voiceSelector) return;

    // Clear existing options
    voiceSelector.innerHTML = '';

    // Add auto option
    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto-Select Best Voice';
    voiceSelector.appendChild(autoOption);

    try {
        // Get available voices for target language
        const voices = completePipeline.ttsManager.getAvailableVoicesForLanguage(targetLang);

        // Create a flattened list of all voices
        const allVoices = [];

        // Add voices from each provider and gender group
        Object.entries(voices).forEach(([provider, genderGroups]) => {
            Object.entries(genderGroups).forEach(([gender, voiceList]) => {
                voiceList.forEach(voice => {
                    allVoices.push({
                        id: voice.id,
                        name: voice.name,
                        provider,
                        gender,
                        quality: voice.quality
                    });
                });
            });
        });

        // Sort by quality and then by name
        allVoices.sort((a, b) => {
            // Premium voices first
            if (a.quality === 'premium' && b.quality !== 'premium') return -1;
            if (a.quality !== 'premium' && b.quality === 'premium') return 1;

            // Then neural/wavenet voices
            if ((a.quality === 'neural' || a.quality === 'wavenet') &&
                (b.quality !== 'neural' && b.quality !== 'wavenet')) return -1;
            if ((a.quality !== 'neural' && a.quality !== 'wavenet') &&
                (b.quality === 'neural' || b.quality === 'wavenet')) return 1;

            // Then alphabetically by name
            return a.name.localeCompare(b.name);
        });

        // Add each voice to the selector
        allVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.id;
            option.textContent = `${voice.name} (${voice.provider}, ${voice.gender})`;
            option.dataset.provider = voice.provider;
            option.dataset.gender = voice.gender;
            voiceSelector.appendChild(option);
        });

        // Update total voice count
        const totalVoicesElem = document.getElementById('totalVoices');
        if (totalVoicesElem) {
            totalVoicesElem.textContent = `${allVoices.length} voices available for ${targetLang}`;
        }
    } catch (error) {
        console.error('Error updating voice selectors:', error);
    }
}

// Create the complete pipeline UI
function createCompletePipelineUI() {
    const container = document.querySelector('.translation-section');
    if (!container) return;

    // Create the complete pipeline controls
    const pipelineControls = document.createElement('div');
    pipelineControls.id = 'completePipelineControls';
    pipelineControls.className = 'complete-pipeline-section';

    pipelineControls.innerHTML = `
        <h3>Complete STT → Translation → TTS Pipeline</h3>
        
        <div class="pipeline-controls-grid">
            <div class="language-controls-complete">
                <div class="language-selector">
                    <label for="sourceLanguageComplete">From:</label>
                    <select id="sourceLanguageComplete">
                        <option value="auto">Auto-Detect</option>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                        <option value="zh">Chinese</option>
                    </select>
                </div>
                
                <button id="swapLanguagesComplete" class="icon-button swap-btn">
                    <span class="material-icons">swap_horiz</span>
                </button>
                
                <div class="language-selector">
                    <label for="targetLanguageComplete">To:</label>
                    <select id="targetLanguageComplete">
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                        <option value="zh">Chinese</option>
                    </select>
                </div>
            </div>
            
            <div class="voice-controls">
                <label for="voiceSelector">Voice:</label>
                <select id="voiceSelector">
                    <option value="auto">Auto-Select Best Voice</option>
                </select>
                <button id="testVoiceButton" class="btn-secondary">Test Voice</button>
                <div id="totalVoices" class="total-voices">0 voices available</div>
            </div>
            
            <div class="pipeline-actions">
                <button id="completePipelineButton" class="btn-primary btn-pipeline">
                    Start Complete Pipeline
                </button>
                <button id="testPipelineButton" class="btn-secondary">
                    Test Pipeline
                </button>
                <button id="clearHistoryButton" class="btn-secondary">
                    Clear History
                </button>
            </div>
        </div>
        
        <div id="pipelineMetrics" class="pipeline-metrics">
            <h4>Pipeline Metrics</h4>
            <div class="metrics-grid">
                <div class="metric-item">
                    <span class="metric-label">Total Processed:</span>
                    <span class="metric-value">0</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Success Rate:</span>
                    <span class="metric-value">100%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Avg. Latency:</span>
                    <span class="metric-value">0ms</span>
                </div>
            </div>
        </div>
    `;

    // Create the results display section
    const resultsDisplay = document.createElement('div');
    resultsDisplay.className = 'pipeline-results-section';
    resultsDisplay.innerHTML = `
        <h3>Real-Time Translation Results</h3>
        <div id="completePipelineDisplay" class="pipeline-display">
            <div class="pipeline-placeholder">
                Real-time translation results will appear here...
            </div>
        </div>
    `;

    // Add the elements to the container
    container.appendChild(pipelineControls);
    container.appendChild(resultsDisplay);

    // Set up event listeners for the new controls
    document.getElementById('completePipelineButton').addEventListener('click', toggleCompletePipeline);
    document.getElementById('testPipelineButton').addEventListener('click', testCompletePipeline);
    document.getElementById('testVoiceButton').addEventListener('click', testSelectedVoice);
    document.getElementById('clearHistoryButton').addEventListener('click', clearCompletePipelineHistory);
    document.getElementById('swapLanguagesComplete').addEventListener('click', swapLanguagesComplete);

    // Set up language change listeners
    document.getElementById('sourceLanguageComplete').addEventListener('change', handleLanguageChange);
    document.getElementById('targetLanguageComplete').addEventListener('change', handleLanguageChange);

    // Set up voice change listener
    document.getElementById('voiceSelector').addEventListener('change', handleVoiceChange);
}

// Handle language change
function handleLanguageChange() {
    if (!completePipeline) return;

    const sourceLang = document.getElementById('sourceLanguageComplete').value;
    const targetLang = document.getElementById('targetLanguageComplete').value;

    // Update pipeline languages
    completePipeline.setLanguages(sourceLang, targetLang);

    // Update available voices
    updateVoiceSelectors();

    updateStatus(`Languages changed: ${sourceLang} → ${targetLang}`);
}

// Handle voice change
function handleVoiceChange() {
    if (!completePipeline) return;

    const voice = document.getElementById('voiceSelector').value;

    // Update pipeline voice
    completePipeline.setVoice(voice);

    updateStatus(`Voice changed to: ${voice}`);
}

// Swap languages for complete pipeline
function swapLanguagesComplete() {
    if (!completePipeline) return;

    const sourceSelect = document.getElementById('sourceLanguageComplete');
    const targetSelect = document.getElementById('targetLanguageComplete');

    // Skip if source is auto
    if (sourceSelect.value === 'auto') {
        updateStatus('Cannot swap when source language is set to Auto-Detect');
        return;
    }

    // Swap language selections
    const tempLang = sourceSelect.value;
    sourceSelect.value = targetSelect.value;
    targetSelect.value = tempLang;

    // Update pipeline
    handleLanguageChange();
}

// Clear complete pipeline history
function clearCompletePipelineHistory() {
    const container = document.getElementById('completePipelineDisplay');
    if (!container) return;

    // Remove all results except the placeholder
    const placeholder = container.querySelector('.pipeline-placeholder');
    container.innerHTML = '';

    if (placeholder) {
        container.appendChild(placeholder);
    } else {
        container.innerHTML = `
            <div class="pipeline-placeholder">
                Real-time translation results will appear here...
            </div>
        `;
    }

    // Clear audio store
    audioPlaybackStore.forEach(url => URL.revokeObjectURL(url));
    audioPlaybackStore.clear();

    updateStatus('Complete pipeline history cleared');
}

// Handle complete pipeline activation
function handleCompletePipelineActivated(data) {
    updateStatus(`Complete pipeline activated (${data.conversationId})`);
    isCompletePipelineActive = true;

    // Update button state
    const pipelineBtn = document.getElementById('completePipelineButton');
    if (pipelineBtn) {
        pipelineBtn.textContent = 'Stop Complete Pipeline';
        pipelineBtn.classList.add('btn-stop');
    }

    // Update metrics
    updateCompletePipelineMetrics();
}

// Handle complete pipeline deactivation
function handleCompletePipelineDeactivated() {
    updateStatus('Complete pipeline deactivated');
    isCompletePipelineActive = false;

    // Update button state
    const pipelineBtn = document.getElementById('completePipelineButton');
    if (pipelineBtn) {
        pipelineBtn.textContent = 'Start Complete Pipeline';
        pipelineBtn.classList.remove('btn-stop');
    }
}

// Handle complete pipeline language changes
function handleCompletePipelineLanguagesChanged(data) {
    updateStatus(`Pipeline languages changed: ${data.sourceLanguage} → ${data.targetLanguage}`);

    // Update UI selectors to match
    const sourceSelect = document.getElementById('sourceLanguageComplete');
    const targetSelect = document.getElementById('targetLanguageComplete');

    if (sourceSelect && data.sourceLanguage !== 'auto') {
        sourceSelect.value = data.sourceLanguage;
    }

    if (targetSelect) {
        targetSelect.value = data.targetLanguage;
    }

    // Update voices
    updateVoiceSelectors();
}
