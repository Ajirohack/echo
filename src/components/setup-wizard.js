/**
 * Setup wizard for echo
 *
 * Provides a comprehensive setup experience for new users
 * including audio device configuration, API key setup, and testing.
 */

class SetupWizard {
  constructor() {
    this.currentStep = 0;
    this.totalSteps = 5;
    this.config = {
      apiKeys: {},
      audioDevices: {},
      virtualAudio: false,
      preferences: {},
    };

    this.steps = ['welcome', 'virtual-audio', 'api-keys', 'audio-devices', 'complete'];

    this.init();
  }

  init() {
    this.createWizardUI();
    this.showStep(0);
  }

  createWizardUI() {
    // Create wizard container
    const wizardContainer = document.createElement('div');
    wizardContainer.id = 'setup-wizard';
    wizardContainer.className = 'setup-wizard-overlay';

    wizardContainer.innerHTML = `
      <div class="setup-wizard-modal">
        <div class="setup-wizard-header">
          <h2>echo Setup</h2>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="step-indicator">
            Step <span id="current-step">1</span> of <span id="total-steps">${this.totalSteps}</span>
          </div>
        </div>
        
        <div class="setup-wizard-content" id="wizard-content">
          <!-- Step content will be inserted here -->
        </div>
        
        <div class="setup-wizard-footer">
          <button id="prev-button" class="btn btn-secondary" style="display: none;">Previous</button>
          <button id="next-button" class="btn btn-primary">Next</button>
          <button id="skip-button" class="btn btn-link">Skip Setup</button>
        </div>
      </div>
    `;

    document.body.appendChild(wizardContainer);

    // Add event listeners
    document.getElementById('next-button').addEventListener('click', () => this.nextStep());
    document.getElementById('prev-button').addEventListener('click', () => this.prevStep());
    document.getElementById('skip-button').addEventListener('click', () => this.skipSetup());

    // Add styles
    this.addStyles();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .setup-wizard-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      
      .setup-wizard-modal {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .setup-wizard-header {
        padding: 20px;
        border-bottom: 1px solid #eee;
        text-align: center;
      }
      
      .setup-wizard-header h2 {
        margin: 0 0 15px 0;
        color: #333;
      }
      
      .progress-bar {
        background: #f0f0f0;
        height: 6px;
        border-radius: 3px;
        margin-bottom: 10px;
        overflow: hidden;
      }
      
      .progress-fill {
        background: #007bff;
        height: 100%;
        transition: width 0.3s ease;
      }
      
      .step-indicator {
        font-size: 14px;
        color: #666;
      }
      
      .setup-wizard-content {
        padding: 30px;
        flex: 1;
        overflow-y: auto;
      }
      
      .setup-wizard-footer {
        padding: 20px;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: #007bff;
        color: white;
      }
      
      .btn-primary:hover {
        background: #0056b3;
      }
      
      .btn-secondary {
        background: #6c757d;
        color: white;
      }
      
      .btn-secondary:hover {
        background: #545b62;
      }
      
      .btn-link {
        background: transparent;
        color: #007bff;
        text-decoration: underline;
      }
      
      .step-content {
        text-align: center;
      }
      
      .step-content h3 {
        margin-bottom: 20px;
        color: #333;
      }
      
      .step-content p {
        line-height: 1.6;
        color: #666;
        margin-bottom: 20px;
      }
      
      .form-group {
        margin-bottom: 20px;
        text-align: left;
      }
      
      .form-group label {
        display: block;
      }
      
      .app-config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin: 15px 0;
      }
      
      .app-config-item {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        border-left: 3px solid #007bff;
      }
      
      .app-config-item h6 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 14px;
      }
      
      .app-config-item ol {
        margin: 0;
        padding-left: 20px;
        font-size: 12px;
        line-height: 1.4;
      }
      
      .app-config-item li {
        margin-bottom: 5px;
      }
        margin-bottom: 5px;
        font-weight: bold;
        color: #333;
      }
      
      .form-group input,
      .form-group select {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .form-group input:focus,
      .form-group select:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
      }
      
      .api-service {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 15px;
        margin-bottom: 15px;
      }
      
      .api-service.selected {
        border-color: #007bff;
        background: #f8f9ff;
      }
      
      .api-service h4 {
        margin: 0 0 10px 0;
        color: #333;
      }
      
      .api-service p {
        margin: 0 0 10px 0;
        font-size: 13px;
        color: #666;
      }
      
      .test-button {
        background: #28a745;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
      }
      
      .test-button:hover {
        background: #218838;
      }
      
      .test-result {
        margin-top: 10px;
        padding: 5px 10px;
        border-radius: 3px;
        font-size: 12px;
      }
      
      .test-result.success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }
      
      .test-result.error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }
      
      .device-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
      }
      
      .device-item {
        padding: 10px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .device-item:last-child {
        border-bottom: none;
      }
      
      .device-item:hover {
        background: #f8f9fa;
      }
      
      .device-item.selected {
        background: #007bff;
        color: white;
      }
      
      .status-icon {
        font-size: 20px;
        margin-bottom: 15px;
      }
      
      .status-icon.success {
        color: #28a745;
      }
      
      .status-icon.warning {
        color: #ffc107;
      }
      
      .status-icon.error {
        color: #dc3545;
      }
    `;

    document.head.appendChild(style);
  }

  showStep(stepIndex) {
    this.currentStep = stepIndex;
    const stepName = this.steps[stepIndex];
    const progress = ((stepIndex + 1) / this.totalSteps) * 100;

    // Update progress bar
    document.querySelector('.progress-fill').style.width = `${progress}%`;
    document.getElementById('current-step').textContent = stepIndex + 1;

    // Update buttons
    const prevBtn = document.getElementById('prev-button');
    const nextBtn = document.getElementById('next-button');
    const skipBtn = document.getElementById('skip-button');

    prevBtn.style.display = stepIndex > 0 ? 'block' : 'none';

    if (stepIndex === this.totalSteps - 1) {
      nextBtn.textContent = 'Finish';
      skipBtn.style.display = 'none';
    } else {
      nextBtn.textContent = 'Next';
      skipBtn.style.display = 'block';
    }

    // Show step content
    this.renderStepContent(stepName);
  }

  renderStepContent(stepName) {
    const content = document.getElementById('wizard-content');

    switch (stepName) {
      case 'welcome':
        content.innerHTML = this.renderWelcomeStep();
        break;
      case 'virtual-audio':
        content.innerHTML = this.renderVirtualAudioStep();
        this.checkVirtualAudio();
        break;
      case 'api-keys':
        content.innerHTML = this.renderApiKeysStep();
        break;
      case 'audio-devices':
        content.innerHTML = this.renderAudioDevicesStep();
        this.loadAudioDevices();
        break;
      case 'complete':
        content.innerHTML = this.renderCompleteStep();
        break;
    }
  }

  renderWelcomeStep() {
    return `
      <div class="step-content">
        <div class="status-icon">🎉</div>
        <h3>Welcome to echo!</h3>
        <p>This setup wizard will help you configure echo for optimal performance.</p>
        <p>We'll guide you through:</p>
        <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
          <li>Setting up virtual audio devices</li>
          <li>Configuring translation service API keys</li>
          <li>Selecting audio input/output devices</li>
          <li>Testing your configuration</li>
        </ul>
        <p>The setup process takes about 5 minutes and ensures the best experience with communication platforms like Discord, Zoom, and Teams.</p>
      </div>
    `;
  }

  renderVirtualAudioStep() {
    return `
      <div class="step-content">
        <div class="status-icon" id="virtual-audio-status">⏳</div>
        <h3>Virtual Audio Setup</h3>
        <p>Virtual audio devices allow echo to send translated audio to communication platforms.</p>
        
        <div id="virtual-audio-info">
          <p>Checking virtual audio device availability...</p>
        </div>
        
        <div id="virtual-audio-actions" style="display: none;">
          <button id="install-virtual-audio" class="btn btn-primary">Install Virtual Audio Device</button>
          <p style="font-size: 12px; margin-top: 10px; color: #666;">
            This will install the required virtual audio driver for your platform
          </p>
        </div>

        <div id="platform-specific-help" style="display: none; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
          <h4>Platform-Specific Setup</h4>
          <div id="platform-instructions"></div>
          <button id="open-troubleshooting" class="btn btn-link" style="margin-top: 10px;">Open Troubleshooting Guide</button>
        </div>

        <div id="communication-apps-setup" style="display: none; margin-top: 20px;">
          <h4>Communication App Configuration</h4>
          <div id="app-config-instructions"></div>
          <button id="auto-configure-apps" class="btn btn-secondary" style="margin-top: 10px;">Auto-Configure Apps</button>
        </div>
      </div>
    `;
  }

  renderApiKeysStep() {
    return `
      <div class="step-content">
        <h3>Translation Services</h3>
        <p>Configure at least one translation service to start using echo.</p>
        
        <div class="api-service" id="deepl-service">
          <h4>DeepL API (Recommended)</h4>
          <p>Best for European languages, high quality translations</p>
          <div class="form-group">
            <label for="deepl-key">API Key:</label>
            <input type="password" id="deepl-key" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
            <button class="test-button" onclick="setupWizard.testApiKey('deepl')">Test</button>
          </div>
          <div id="deepl-result" class="test-result" style="display: none;"></div>
        </div>
        
        <div class="api-service" id="openai-service">
          <h4>OpenAI GPT-4o</h4>
          <p>Best for context-aware translations and idioms</p>
          <div class="form-group">
            <label for="openai-key">API Key:</label>
            <input type="password" id="openai-key" placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
            <button class="test-button" onclick="setupWizard.testApiKey('openai')">Test</button>
          </div>
          <div id="openai-result" class="test-result" style="display: none;"></div>
        </div>
        
        <div class="api-service" id="google-service">
          <h4>Google Translate</h4>
          <p>Fast and reliable, good language coverage</p>
          <div class="form-group">
            <label for="google-key">API Key:</label>
            <input type="password" id="google-key" placeholder="Your Google Cloud API Key">
            <button class="test-button" onclick="setupWizard.testApiKey('google')">Test</button>
          </div>
          <div id="google-result" class="test-result" style="display: none;"></div>
        </div>
        
        <p style="font-size: 12px; color: #666; margin-top: 20px;">
          <strong>Need API keys?</strong> Visit our <a href="#" onclick="setupWizard.openApiGuide()">API Setup Guide</a> for detailed instructions.
        </p>
      </div>
    `;
  }

  renderAudioDevicesStep() {
    return `
      <div class="step-content">
        <h3>Audio Device Configuration</h3>
        <p>Select your microphone and configure audio routing for communication platforms.</p>
        
        <div class="form-group">
          <label>Microphone (Input):</label>
          <div id="input-devices" class="device-list">
            <div class="device-item">Loading audio devices...</div>
          </div>
          <button id="test-microphone" class="btn btn-secondary" style="margin-top: 10px;">Test Microphone</button>
        </div>
        
        <div class="form-group">
          <label>Virtual Audio Output:</label>
          <div id="output-devices" class="device-list">
            <div class="device-item">Loading virtual devices...</div>
          </div>
        </div>
        
        <div id="audio-test-result" style="display: none; margin-top: 20px;"></div>
      </div>
    `;
  }

  renderCompleteStep() {
    return `
      <div class="step-content">
        <div class="status-icon success">✅</div>
        <h3>Setup Complete!</h3>
        <p>echo is now configured and ready to use.</p>
        
        <div style="text-align: left; max-width: 400px; margin: 20px auto;">
          <h4>Quick Start:</h4>
          <ol>
            <li>Open your communication app (Discord, Zoom, etc.)</li>
            <li>Set microphone to "Virtual Audio Cable" or "BlackHole"</li>
            <li>Start translation in echo</li>
            <li>Speak - your translated voice will be heard by others!</li>
          </ol>
          
          <h4>Useful Shortcuts:</h4>
          <ul>
            <li><strong>Ctrl+Shift+T</strong>: Start/Stop Translation</li>
            <li><strong>Ctrl+Shift+M</strong>: Toggle Microphone</li>
            <li><strong>Ctrl+Shift+L</strong>: Switch Languages</li>
          </ul>
        </div>
        
        <p>Need help? Check out our <a href="#" onclick="setupWizard.openUserGuide()">User Guide</a> or join our <a href="#" onclick="setupWizard.openCommunity()">Community Discord</a>.</p>
      </div>
    `;
  }

  async checkVirtualAudio() {
    const statusIcon = document.getElementById('virtual-audio-status');
    const infoDiv = document.getElementById('virtual-audio-info');
    const actionsDiv = document.getElementById('virtual-audio-actions');
    const platformHelpDiv = document.getElementById('platform-specific-help');
    const appsSetupDiv = document.getElementById('communication-apps-setup');

    try {
      // Check if virtual audio is available
      const result = await window.electronAPI.checkVirtualAudio();

      if (result.available) {
        statusIcon.textContent = '✅';
        statusIcon.className = 'status-icon success';
        infoDiv.innerHTML = `
          <p style="color: #28a745;">✅ Virtual audio device is available!</p>
          <p><strong>Device:</strong> ${result.deviceName}</p>
          <p>You can now route translated audio to communication platforms.</p>
        `;
        this.config.virtualAudio = true;

        // Show communication app setup
        appsSetupDiv.style.display = 'block';
        this.showCommunicationAppSetup();
      } else {
        statusIcon.textContent = '⚠️';
        statusIcon.className = 'status-icon warning';
        infoDiv.innerHTML = `
          <p style="color: #ffc107;">⚠️ Virtual audio device not found</p>
          <p>A virtual audio device is required to send translated audio to communication platforms like Discord, Zoom, and Teams.</p>
        `;
        actionsDiv.style.display = 'block';
        platformHelpDiv.style.display = 'block';
        this.showPlatformSpecificHelp();

        // Add install button handler
        document.getElementById('install-virtual-audio').addEventListener('click', () => {
          this.installVirtualAudio();
        });
      }

      // Add troubleshooting button handler
      document.getElementById('open-troubleshooting').addEventListener('click', () => {
        this.openTroubleshootingGuide();
      });
    } catch (error) {
      statusIcon.textContent = '❌';
      statusIcon.className = 'status-icon error';
      infoDiv.innerHTML = `
        <p style="color: #dc3545;">❌ Error checking virtual audio</p>
        <p>Error: ${error.message}</p>
      `;
      platformHelpDiv.style.display = 'block';
      this.showPlatformSpecificHelp();
    }
  }

  async installVirtualAudio() {
    const button = document.getElementById('install-virtual-audio');
    const originalText = button.textContent;

    button.textContent = 'Installing...';
    button.disabled = true;

    try {
      await window.electronAPI.installVirtualAudio();

      // Recheck after installation
      setTimeout(() => {
        this.checkVirtualAudio();
      }, 2000);
    } catch (error) {
      button.textContent = originalText;
      button.disabled = false;

      const infoDiv = document.getElementById('virtual-audio-info');
      infoDiv.innerHTML += `
        <p style="color: #dc3545; margin-top: 10px;">❌ Installation failed: ${error.message}</p>
        <p>You may need to install the virtual audio device manually.</p>
      `;
    }
  }

  async testApiKey(service) {
    const keyInput = document.getElementById(`${service}-key`);
    const resultDiv = document.getElementById(`${service}-result`);
    const serviceDiv = document.getElementById(`${service}-service`);

    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      resultDiv.innerHTML = 'Please enter an API key';
      resultDiv.className = 'test-result error';
      resultDiv.style.display = 'block';
      return;
    }

    resultDiv.innerHTML = 'Testing...';
    resultDiv.className = 'test-result';
    resultDiv.style.display = 'block';

    try {
      const result = await window.electronAPI.testApiKey(service, apiKey);

      if (result.success) {
        resultDiv.innerHTML = '✅ API key is valid';
        resultDiv.className = 'test-result success';
        serviceDiv.classList.add('selected');
        this.config.apiKeys[service] = apiKey;
      } else {
        resultDiv.innerHTML = `❌ ${result.error}`;
        resultDiv.className = 'test-result error';
        serviceDiv.classList.remove('selected');
        delete this.config.apiKeys[service];
      }
    } catch (error) {
      resultDiv.innerHTML = `❌ Test failed: ${error.message}`;
      resultDiv.className = 'test-result error';
      serviceDiv.classList.remove('selected');
      delete this.config.apiKeys[service];
    }
  }

  async loadAudioDevices() {
    try {
      const devices = await window.electronAPI.getAudioDevices();

      // Populate input devices
      const inputList = document.getElementById('input-devices');
      inputList.innerHTML = '';

      devices.input.forEach((device) => {
        const deviceItem = document.createElement('div');
        deviceItem.className = 'device-item';
        deviceItem.innerHTML = `
          <span>${device.name}</span>
          <span style="font-size: 12px; color: #666;">${device.type}</span>
        `;
        deviceItem.addEventListener('click', () => {
          // Remove previous selection
          inputList.querySelectorAll('.device-item').forEach((item) => {
            item.classList.remove('selected');
          });
          // Select this device
          deviceItem.classList.add('selected');
          this.config.audioDevices.input = device.id;
        });
        inputList.appendChild(deviceItem);
      });

      // Populate output devices (virtual)
      const outputList = document.getElementById('output-devices');
      outputList.innerHTML = '';

      const virtualDevices = devices.output.filter(
        (device) =>
          device.name.toLowerCase().includes('cable') ||
          device.name.toLowerCase().includes('blackhole') ||
          device.name.toLowerCase().includes('virtual')
      );

      if (virtualDevices.length === 0) {
        outputList.innerHTML = '<div class="device-item">No virtual audio devices found</div>';
      } else {
        virtualDevices.forEach((device) => {
          const deviceItem = document.createElement('div');
          deviceItem.className = 'device-item';
          deviceItem.innerHTML = `
            <span>${device.name}</span>
            <span style="font-size: 12px; color: #666;">Virtual</span>
          `;
          deviceItem.addEventListener('click', () => {
            outputList.querySelectorAll('.device-item').forEach((item) => {
              item.classList.remove('selected');
            });
            deviceItem.classList.add('selected');
            this.config.audioDevices.output = device.id;
          });
          outputList.appendChild(deviceItem);
        });
      }

      // Add microphone test button handler
      document.getElementById('test-microphone').addEventListener('click', () => {
        this.testMicrophone();
      });
    } catch (error) {
      console.error('Failed to load audio devices:', error);
    }
  }

  async testMicrophone() {
    const testButton = document.getElementById('test-microphone');
    const resultDiv = document.getElementById('audio-test-result');

    testButton.textContent = 'Testing...';
    testButton.disabled = true;

    resultDiv.innerHTML = 'Testing microphone for 3 seconds...';
    resultDiv.style.display = 'block';

    try {
      const result = await window.electronAPI.testMicrophone(this.config.audioDevices.input, 3000);

      if (result.success) {
        resultDiv.innerHTML = `
          <div style="color: #28a745;">✅ Microphone test successful!</div>
          <div>Max volume: ${Math.round(result.maxVolume * 100)}%</div>
          <div>Duration: ${result.duration}ms</div>
        `;
      } else {
        resultDiv.innerHTML = `
          <div style="color: #dc3545;">❌ Microphone test failed</div>
          <div>${result.error}</div>
        `;
      }
    } catch (error) {
      resultDiv.innerHTML = `
        <div style="color: #dc3545;">❌ Test error: ${error.message}</div>
      `;
    } finally {
      testButton.textContent = 'Test Microphone';
      testButton.disabled = false;
    }
  }

  nextStep() {
    if (this.currentStep < this.totalSteps - 1) {
      this.showStep(this.currentStep + 1);
    } else {
      this.completeSetup();
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  async completeSetup() {
    try {
      // Save configuration
      await window.electronAPI.saveSetupConfig(this.config);

      // Close wizard
      this.closeWizard();

      // Show success message
      alert('Setup completed successfully! echo is ready to use.');
    } catch (error) {
      alert('Error saving configuration: ' + error.message);
    }
  }

  skipSetup() {
    if (
      confirm(
        'Are you sure you want to skip the setup? You can run it again later from the Help menu.'
      )
    ) {
      this.closeWizard();
    }
  }

  closeWizard() {
    const wizard = document.getElementById('setup-wizard');
    if (wizard) {
      wizard.remove();
    }
  }

  openApiGuide() {
    window.electronAPI.openExternal('https://docs.universaltranslator.app/api-setup');
  }

  openUserGuide() {
    window.electronAPI.openExternal('https://docs.universaltranslator.app');
  }

  openCommunity() {
    window.electronAPI.openExternal('https://discord.gg/universaltranslator');
  }

  showPlatformSpecificHelp() {
    const platform = navigator.platform.toLowerCase();
    const instructionsDiv = document.getElementById('platform-instructions');

    let platformInfo = '';

    if (platform.includes('win')) {
      platformInfo = `
                <h5>Windows Setup Instructions:</h5>
                <ol>
                    <li><strong>Install VB-Audio Cable:</strong> Download and install from <a href="https://vb-audio.com/Cable/" target="_blank">vb-audio.com</a></li>
                    <li><strong>Restart your computer</strong> after installation</li>
                    <li><strong>Check Windows Audio Settings:</strong>
                        <ul>
                            <li>Right-click speaker icon → Sound settings</li>
                            <li>Verify "CABLE Input" and "CABLE Output" are listed</li>
                            <li>Set "CABLE Input" as default recording device</li>
                        </ul>
                    </li>
                    <li><strong>Fix Permissions:</strong> Settings → Privacy → Microphone → Allow echo</li>
                </ol>
                <p><strong>Common Issues:</strong></p>
                <ul>
                    <li>If devices don't appear, restart Windows Audio service</li>
                    <li>If no audio, check microphone permissions</li>
                    <li>If echo, use headphones instead of speakers</li>
                </ul>
            `;
    } else if (platform.includes('mac')) {
      platformInfo = `
                <h5>macOS Setup Instructions:</h5>
                <ol>
                    <li><strong>Install BlackHole:</strong> Download from <a href="https://existential.audio/blackhole/" target="_blank">existential.audio</a></li>
                    <li><strong>Restart your computer</strong> after installation</li>
                    <li><strong>Check Audio MIDI Setup:</strong>
                        <ul>
                            <li>Applications → Utilities → Audio MIDI Setup</li>
                            <li>Verify "BlackHole 2ch" is listed</li>
                            <li>Set sample rate to 48000Hz</li>
                        </ul>
                    </li>
                    <li><strong>Fix Permissions:</strong> System Preferences → Security & Privacy → Privacy → Microphone → Add echo</li>
                </ol>
                <p><strong>Common Issues:</strong></p>
                <ul>
                    <li>If BlackHole doesn't appear, reinstall and restart</li>
                    <li>If no audio, check microphone permissions</li>
                    <li>If apps don't detect BlackHole, try aggregate devices</li>
                </ul>
            `;
    } else {
      platformInfo = `
                <h5>Linux Setup Instructions:</h5>
                <ol>
                    <li><strong>Install PulseAudio utilities:</strong> <code>sudo apt install pulseaudio pulseaudio-utils</code></li>
                    <li><strong>Create virtual sinks:</strong> The app will create them automatically</li>
                    <li><strong>Check audio permissions:</strong> <code>sudo usermod -a -G audio $USER</code></li>
                    <li><strong>Restart PulseAudio:</strong> <code>pulseaudio --kill && pulseaudio --start</code></li>
                </ol>
                <p><strong>Common Issues:</strong></p>
                <ul>
                    <li>If virtual sinks don't appear, create them manually</li>
                    <li>If no audio, check user is in audio group</li>
                    <li>If apps don't detect devices, use pavucontrol</li>
                </ul>
            `;
    }

    instructionsDiv.innerHTML = platformInfo;
  }

  showCommunicationAppSetup() {
    const instructionsDiv = document.getElementById('app-config-instructions');

    const appInstructions = `
            <h5>Configure Your Communication Apps:</h5>
            <div class="app-config-grid">
                <div class="app-config-item">
                    <h6>Discord</h6>
                    <ol>
                        <li>Open Discord Settings → Voice & Video</li>
                        <li>Set Input Device to "CABLE Input" (Windows) / "BlackHole 2ch" (macOS) / "Virtual_Translation_Source" (Linux)</li>
                        <li>Set Output Device to your speakers/headphones</li>
                        <li>Disable "Use Legacy Audio Subsystem"</li>
                    </ol>
                </div>
                <div class="app-config-item">
                    <h6>Zoom</h6>
                    <ol>
                        <li>Open Zoom Settings → Audio</li>
                        <li>Set Microphone to virtual audio device</li>
                        <li>Set Speaker to your regular speakers</li>
                        <li>Enable "Suppress background noise"</li>
                    </ol>
                </div>
                <div class="app-config-item">
                    <h6>Microsoft Teams</h6>
                    <ol>
                        <li>Open Teams Settings → Devices</li>
                        <li>Set Microphone to virtual audio device</li>
                        <li>Set Speaker to your regular speakers</li>
                        <li>Disable "Noise suppression"</li>
                    </ol>
                </div>
            </div>
            <p><strong>Pro Tip:</strong> Use headphones to prevent audio feedback and echo.</p>
        `;

    instructionsDiv.innerHTML = appInstructions;

    // Add auto-configure button handler
    document.getElementById('auto-configure-apps').addEventListener('click', () => {
      this.autoConfigureCommunicationApps();
    });
  }

  async autoConfigureCommunicationApps() {
    const button = document.getElementById('auto-configure-apps');
    const originalText = button.textContent;

    button.textContent = 'Configuring...';
    button.disabled = true;

    try {
      // This would integrate with the PlatformDetector to auto-configure apps
      const result = await window.electronAPI.autoConfigureApps();

      if (result.success) {
        button.textContent = '✅ Configured!';
        this.showAutomationResults(result);
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 2000);
      } else {
        this.showAutomationResults(result);
        throw new Error(result.errors ? result.errors.join('\n') : 'Unknown error');
      }
    } catch (error) {
      button.textContent = originalText;
      button.disabled = false;

      // Show manual configuration instructions
      alert(
        `Auto-configuration failed: ${error.message}\n\nPlease configure your communication apps manually using the instructions above.`
      );
    }
  }

  showAutomationResults(result) {
    let html = `<h4>Setup Automation Results</h4><ul style='text-align:left;'>`;
    if (result.steps && Array.isArray(result.steps)) {
      for (const step of result.steps) {
        html += `<li><strong>${step.name}:</strong> ${step.success ? '✅' : '❌'} ${step.message || ''}</li>`;
      }
    }
    if (result.errors && result.errors.length > 0) {
      html += `<li style='color:#dc3545;'><strong>Errors:</strong><ul>`;
      for (const err of result.errors) {
        html += `<li>${err}</li>`;
      }
      html += `</ul></li>`;
    }
    html += '</ul>';

    // Show as modal or alert
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10001';
    modal.innerHTML = `<div style='background:#fff;padding:30px 40px;border-radius:8px;max-width:500px;box-shadow:0 4px 20px rgba(0,0,0,0.2);'>${html}<div style='text-align:right;'><button id='close-automation-modal' class='btn btn-primary'>Close</button></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('close-automation-modal').onclick = () => {
      modal.remove();
    };
  }

  openTroubleshootingGuide() {
    window.electronAPI.openExternal(
      'https://github.com/your-repo/universal-translator/docs/troubleshooting-guide.md'
    );
  }
}

// Make setupWizard globally available
window.setupWizard = null;

// Function to start setup wizard
window.startSetupWizard = function () {
  if (window.setupWizard) {
    window.setupWizard.closeWizard();
  }
  window.setupWizard = new SetupWizard();
};

// Auto-start setup wizard if not already configured
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const isSetupComplete = await window.electronAPI.isSetupComplete();
    if (!isSetupComplete) {
      setTimeout(() => {
        window.startSetupWizard();
      }, 1000);
    }
  } catch (error) {
    console.error('Error checking setup status:', error);
  }
});
