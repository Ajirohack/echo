const { EventEmitter } = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);

class AudioDeviceManager extends EventEmitter {
  constructor() {
    super();
    this.platform = os.platform();
    this.devices = {
      inputs: [],
      outputs: [],
      virtual: [],
    };
    this.defaultInput = null;
    this.defaultOutput = null;
    this.pollingInterval = null;
    this.translationPipeline = null;
    this.isConnectedToPipeline = false;
    this.activeDevices = {
      input: null,
      output: null,
    };
  }

  /**
   * Initialize the device manager and start monitoring for device changes
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.refreshDevices();

    // Start polling for device changes (every 5 seconds)
    this.pollingInterval = setInterval(() => this.checkForDeviceChanges(), 5000);

    // Listen for system events on supported platforms
    this.setupSystemListeners();
  }

  /**
   * Refresh the list of available audio devices
   * @returns {Promise<void>}
   */
  async refreshDevices() {
    try {
      const oldDevices = JSON.parse(JSON.stringify(this.devices));

      if (this.platform === 'win32') {
        await this.refreshWindowsDevices();
      } else if (this.platform === 'darwin') {
        await this.refreshMacDevices();
      } else if (this.platform === 'linux') {
        await this.refreshLinuxDevices();
      } else {
        throw new Error('Unsupported platform');
      }

      // Check for device changes
      if (JSON.stringify(oldDevices) !== JSON.stringify(this.devices)) {
        this.emit('devicesUpdated', this.devices);
      }

      return this.devices;
    } catch (error) {
      this.emit('error', new Error(`Failed to refresh audio devices: ${error.message}`));
      throw error;
    }
  }

  /**
   * Refresh audio devices on Windows
   * @private
   */
  async refreshWindowsDevices() {
    try {
      // Get input devices
      const { stdout: inputDevices } = await execAsync(
        'powershell -Command "Get-AudioDevice -List | Where-Object { $_.Type -eq \'Recording\' } | ConvertTo-Json"'
      );
      // Get output devices
      const { stdout: outputDevices } = await execAsync(
        'powershell -Command "Get-AudioDevice -List | Where-Object { $_.Type -eq \'Playback\' } | ConvertTo-Json"'
      );

      this.devices.inputs = [];
      this.devices.outputs = [];
      this.devices.virtual = [];

      // Parse and categorize input devices
      if (inputDevices && inputDevices.trim()) {
        const inputs = JSON.parse(inputDevices);
        if (Array.isArray(inputs)) {
          this.devices.inputs = inputs.map((device) => ({
            id: device.ID,
            name: device.Name,
            type: 'input',
            isDefault: device.Default,
            isVirtual: this.isVirtualDevice(device.Name),
          }));
        }
      }

      // Parse and categorize output devices
      if (outputDevices && outputDevices.trim()) {
        const outputs = JSON.parse(outputDevices);
        if (Array.isArray(outputs)) {
          this.devices.outputs = outputs.map((device) => ({
            id: device.ID,
            name: device.Name,
            type: 'output',
            isDefault: device.Default,
            isVirtual: this.isVirtualDevice(device.Name),
          }));
        }
      }

      // Find virtual devices
      this.devices.virtual = [...this.devices.inputs, ...this.devices.outputs].filter(
        (device) => device.isVirtual
      );

      // Get default devices
      await this.updateDefaultDevices();
    } catch (error) {
      throw new Error(`Failed to refresh Windows audio devices: ${error.message}`);
    }
  }

  /**
   * Refresh audio devices on macOS
   * @private
   */
  async refreshMacDevices() {
    try {
      // Use system_profiler to get audio devices
      const { stdout } = await execAsync('system_profiler SPAudioDataType -json');
      const audioData = JSON.parse(stdout);

      this.devices.inputs = [];
      this.devices.outputs = [];
      this.devices.virtual = [];

      if (audioData.SPAudioDataType && Array.isArray(audioData.SPAudioDataType)) {
        audioData.SPAudioDataType.forEach((device) => {
          const isInput =
            device._items &&
            device._items.some(
              (item) =>
                item._name === 'input_source' && item._spaudio_audio_input_device === 'spaudio_yes'
            );

          const isOutput =
            device._items &&
            device._items.some(
              (item) =>
                item._name === 'output_source' &&
                item._spaudio_audio_output_device === 'spaudio_yes'
            );

          const deviceInfo = {
            id: device._name,
            name: device._name,
            type: isInput && isOutput ? 'both' : isInput ? 'input' : 'output',
            isDefault: device._default_audio_system_device === 'spaudio_yes',
            isVirtual: this.isVirtualDevice(device._name),
          };

          if (isInput) {
            this.devices.inputs.push(deviceInfo);
          }

          if (isOutput) {
            this.devices.outputs.push(deviceInfo);
          }

          if (deviceInfo.isVirtual) {
            this.devices.virtual.push(deviceInfo);
          }
        });
      }

      // Get default devices
      await this.updateDefaultDevices();
    } catch (error) {
      throw new Error(`Failed to refresh macOS audio devices: ${error.message}`);
    }
  }

  /**
   * Refresh audio devices on Linux
   * @private
   */
  async refreshLinuxDevices() {
    try {
      // Use pactl to get audio devices
      const { stdout } = await execAsync("pactl list short sinks | awk '{print $2}'");
      const sinks = stdout.trim().split('\n');

      const { stdout: sources } = await execAsync(
        'pactl list short sources | grep -v ".monitor" | awk \'{print $2}\''
      );
      const sourceList = sources.trim().split('\n');

      this.devices.inputs = [];
      this.devices.outputs = [];
      this.devices.virtual = [];

      // Process output devices (sinks)
      for (const sink of sinks) {
        if (!sink) continue;

        const { stdout: sinkInfo } = await execAsync(`pactl list sinks | grep -A 10 "${sink}$"`);
        const isDefault = sinkInfo.includes('Default Sink: yes');
        const isVirtual = this.isVirtualDevice(sink);

        const deviceInfo = {
          id: sink,
          name: sink,
          type: 'output',
          isDefault,
          isVirtual,
        };

        this.devices.outputs.push(deviceInfo);
        if (isVirtual) this.devices.virtual.push(deviceInfo);
      }

      // Process input devices (sources)
      for (const source of sourceList) {
        if (!source) continue;

        const { stdout: sourceInfo } = await execAsync(
          `pactl list sources | grep -A 10 "${source}$"`
        );
        const isDefault = sourceInfo.includes('Default Source: yes');
        const isVirtual = this.isVirtualDevice(source);

        const deviceInfo = {
          id: source,
          name: source,
          type: 'input',
          isDefault,
          isVirtual,
        };

        this.devices.inputs.push(deviceInfo);
        if (isVirtual) this.devices.virtual.push(deviceInfo);
      }

      // Get default devices
      await this.updateDefaultDevices();
    } catch (error) {
      throw new Error(`Failed to refresh Linux audio devices: ${error.message}`);
    }
  }

  /**
   * Check if a device is a virtual audio device
   * @param {string} deviceName - Device name to check
   * @returns {boolean}
   */
  isVirtualDevice(deviceName) {
    if (!deviceName) return false;

    const virtualDevicePatterns = [
      /vb-?audio/i,
      /cable/i,
      /voicemeeter/i,
      /virtual audio/i,
      /loopback/i,
      /blackhole/i,
      /soundsiphon/i,
      /loopback audio/i,
      /virtual cable/i,
      /virtual device/i,
    ];

    return virtualDevicePatterns.some((pattern) => pattern.test(deviceName));
  }

  /**
   * Update the default input and output devices
   * @private
   */
  async updateDefaultDevices() {
    try {
      // Find default input device
      this.defaultInput = this.devices.inputs.find((device) => device.isDefault) || null;

      // Find default output device
      this.defaultOutput = this.devices.outputs.find((device) => device.isDefault) || null;

      this.emit('defaultDevicesUpdated', {
        input: this.defaultInput,
        output: this.defaultOutput,
      });
    } catch (error) {
      this.emit('error', new Error(`Failed to update default devices: ${error.message}`));
    }
  }

  /**
   * Set the default audio device
   * @param {string} deviceId - Device ID to set as default
   * @param {'input'|'output'} type - Device type
   * @returns {Promise<boolean>}
   */
  async setDefaultDevice(deviceId, type) {
    try {
      if (this.platform === 'win32') {
        // On Windows, we can use nircmd to set the default device
        await execAsync(`nircmd setdefaultsounddevice "${deviceId}" ${type === 'input' ? 2 : 1}`);
      } else if (this.platform === 'darwin') {
        // On macOS, we can use SwitchAudioSource
        await execAsync(`SwitchAudioSource -t ${type} -s "${deviceId}"`);
      } else if (this.platform === 'linux') {
        // On Linux, we can use pacmd to set the default sink/source
        if (type === 'input') {
          await execAsync(`pactl set-default-source "${deviceId}"`);
        } else {
          await execAsync(`pactl set-default-sink "${deviceId}"`);
        }
      }

      // Refresh devices to update the default device status
      await this.refreshDevices();
      return true;
    } catch (error) {
      this.emit('error', new Error(`Failed to set default ${type} device: ${error.message}`));
      return false;
    }
  }

  /**
   * Check for device changes and emit events if needed
   * @private
   */
  async checkForDeviceChanges() {
    try {
      const oldDevices = JSON.parse(JSON.stringify(this.devices));
      await this.refreshDevices();

      // Check for device additions/removals
      const oldDeviceIds = new Set([
        ...oldDevices.inputs.map((d) => d.id),
        ...oldDevices.outputs.map((d) => d.id),
      ]);

      const newDeviceIds = new Set([
        ...this.devices.inputs.map((d) => d.id),
        ...this.devices.outputs.map((d) => d.id),
      ]);

      // Find added devices
      const addedDevices = [
        ...this.devices.inputs.filter((d) => !oldDeviceIds.has(d.id)),
        ...this.devices.outputs.filter(
          (d) => !oldDeviceIds.has(d.id) && !this.devices.inputs.some((input) => input.id === d.id)
        ),
      ];

      // Find removed devices
      const removedDevices = [
        ...oldDevices.inputs.filter((d) => !newDeviceIds.has(d.id)),
        ...oldDevices.outputs.filter(
          (d) => !newDeviceIds.has(d.id) && !oldDevices.inputs.some((input) => input.id === d.id)
        ),
      ];

      // Emit events for device changes
      if (addedDevices.length > 0) {
        this.emit('devicesAdded', addedDevices);
      }

      if (removedDevices.length > 0) {
        this.emit('devicesRemoved', removedDevices);
      }

      // Check for default device changes
      if (
        (this.defaultInput &&
          oldDevices.defaultInput &&
          this.defaultInput.id !== oldDevices.defaultInput.id) ||
        (this.defaultOutput &&
          oldDevices.defaultOutput &&
          this.defaultOutput.id !== oldDevices.defaultOutput.id)
      ) {
        this.emit('defaultDevicesChanged', {
          input: this.defaultInput,
          output: this.defaultOutput,
        });
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to check for device changes: ${error.message}`));
    }
  }

  /**
   * Set up system event listeners for device changes
   * @private
   */
  setupSystemListeners() {
    if (this.platform === 'win32') {
      // On Windows, we can use the Windows Audio Session API events
      // This is a simplified example - in a real app, you'd use the Windows API
      setInterval(() => this.checkForDeviceChanges(), 5000);
    } else if (this.platform === 'darwin') {
      // On macOS, we can use the Core Audio API or check periodically
      setInterval(() => this.checkForDeviceChanges(), 5000);
    } else if (this.platform === 'linux') {
      // On Linux, we can use udev or check periodically
      setInterval(() => this.checkForDeviceChanges(), 5000);
    }
  }

  /**
   * Get all available audio devices
   * @returns {Object} - Object containing arrays of input, output, and virtual devices
   */
  getDevices() {
    return this.devices;
  }

  /**
   * Get the default input device
   * @returns {Object|null} - Default input device or null if not available
   */
  getDefaultInput() {
    return this.defaultInput;
  }

  /**
   * Get the default output device
   * @returns {Object|null} - Default output device or null if not available
   */
  getDefaultOutput() {
    return this.defaultOutput;
  }

  /**
   * Get all virtual audio devices
   * @returns {Array} - Array of virtual audio devices
   */
  getVirtualDevices() {
    return this.devices.virtual;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Disconnect from translation pipeline if connected
    if (this.isConnectedToPipeline && this.translationPipeline) {
      this.disconnectFromTranslationPipeline();
    }

    this.removeAllListeners();
  }

  /**
   * Connect to translation pipeline for audio processing
   * @param {Object} pipeline - Translation pipeline instance
   * @returns {Promise<boolean>} - Connection success
   */
  async connectToTranslationPipeline(pipeline) {
    try {
      if (!pipeline) {
        throw new Error('Invalid translation pipeline provided');
      }

      this.translationPipeline = pipeline;

      // Set up event handlers for pipeline audio events
      this.translationPipeline.on('pipelineActivated', this.handlePipelineActivated.bind(this));
      this.translationPipeline.on('pipelineDeactivated', this.handlePipelineDeactivated.bind(this));

      // Set up audio routing for the pipeline
      await this.setupAudioRouting();

      this.isConnectedToPipeline = true;
      this.emit('pipelineConnected', {
        success: true,
        pipeline: pipeline.constructor.name,
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to translation pipeline:', error);
      this.emit('error', {
        type: 'pipelineConnection',
        message: error.message,
        error,
      });

      return false;
    }
  }

  /**
   * Disconnect from translation pipeline
   * @returns {Promise<boolean>} - Disconnection success
   */
  async disconnectFromTranslationPipeline() {
    try {
      if (!this.translationPipeline || !this.isConnectedToPipeline) {
        return true; // Already disconnected
      }

      // Remove event listeners
      if (this.translationPipeline.removeListener) {
        this.translationPipeline.removeListener(
          'pipelineActivated',
          this.handlePipelineActivated.bind(this)
        );
        this.translationPipeline.removeListener(
          'pipelineDeactivated',
          this.handlePipelineDeactivated.bind(this)
        );
      }

      // Reset audio routing if needed
      if (this.activeDevices.input || this.activeDevices.output) {
        await this.resetAudioRouting();
      }

      this.translationPipeline = null;
      this.isConnectedToPipeline = false;

      this.emit('pipelineDisconnected', { success: true });

      return true;
    } catch (error) {
      console.error('Failed to disconnect from translation pipeline:', error);
      this.emit('error', {
        type: 'pipelineDisconnection',
        message: error.message,
        error,
      });

      return false;
    }
  }

  /**
   * Set up audio routing for the translation pipeline
   * @returns {Promise<void>}
   */
  async setupAudioRouting() {
    // If no active devices are set, use defaults
    if (!this.activeDevices.input) {
      this.activeDevices.input = this.defaultInput;
    }

    if (!this.activeDevices.output) {
      this.activeDevices.output = this.defaultOutput;
    }

    // Notify the pipeline about the active devices
    if (this.translationPipeline && this.translationPipeline.setAudioDevices) {
      await this.translationPipeline.setAudioDevices({
        input: this.activeDevices.input,
        output: this.activeDevices.output,
      });
    }

    this.emit('audioRoutingChanged', {
      input: this.activeDevices.input?.name || 'Default',
      output: this.activeDevices.output?.name || 'Default',
    });
  }

  /**
   * Reset audio routing to default
   * @returns {Promise<void>}
   */
  async resetAudioRouting() {
    // Reset active devices
    this.activeDevices = {
      input: null,
      output: null,
    };

    // Notify about the change
    this.emit('audioRoutingReset');
  }

  /**
   * Set active input device for translation
   * @param {string} deviceId - Device ID to set as active input
   * @returns {Promise<boolean>} - Success status
   */
  async setActiveInputDevice(deviceId) {
    try {
      const device = this.devices.inputs.find((d) => d.id === deviceId);

      if (!device) {
        throw new Error(`Input device with ID ${deviceId} not found`);
      }

      this.activeDevices.input = device;

      // If connected to pipeline, update the routing
      if (this.isConnectedToPipeline && this.translationPipeline) {
        await this.setupAudioRouting();
      }

      this.emit('inputDeviceChanged', { device });

      return true;
    } catch (error) {
      console.error('Failed to set active input device:', error);
      this.emit('error', {
        type: 'deviceSelection',
        message: error.message,
        error,
      });

      return false;
    }
  }

  /**
   * Set active output device for translation
   * @param {string} deviceId - Device ID to set as active output
   * @returns {Promise<boolean>} - Success status
   */
  async setActiveOutputDevice(deviceId) {
    try {
      const device = this.devices.outputs.find((d) => d.id === deviceId);

      if (!device) {
        throw new Error(`Output device with ID ${deviceId} not found`);
      }

      this.activeDevices.output = device;

      // If connected to pipeline, update the routing
      if (this.isConnectedToPipeline && this.translationPipeline) {
        await this.setupAudioRouting();
      }

      this.emit('outputDeviceChanged', { device });

      return true;
    } catch (error) {
      console.error('Failed to set active output device:', error);
      this.emit('error', {
        type: 'deviceSelection',
        message: error.message,
        error,
      });

      return false;
    }
  }

  /**
   * Connect to the translation pipeline
   * @param {Object} translationPipeline - The translation pipeline instance
   * @returns {Promise<boolean>} - True if connection successful
   */
  async connectToPipeline(translationPipeline) {
    try {
      if (!translationPipeline) {
        throw new Error('Invalid translation pipeline');
      }

      this.translationPipeline = translationPipeline;
      this.isConnectedToPipeline = true;

      // Set up event listeners for pipeline events
      this.translationPipeline.on('pipelineActivated', this.handlePipelineActivated.bind(this));
      this.translationPipeline.on('pipelineDeactivated', this.handlePipelineDeactivated.bind(this));
      this.translationPipeline.on('pipelineResult', this.handlePipelineResult.bind(this));
      this.translationPipeline.on('pipelineError', this.handlePipelineError.bind(this));

      // Emit connection event
      this.emit('pipelineConnected', {
        success: true,
        timestamp: Date.now(),
      });

      console.log('AudioDeviceManager connected to translation pipeline');
      return true;
    } catch (error) {
      this.emit('error', new Error(`Failed to connect to translation pipeline: ${error.message}`));
      this.isConnectedToPipeline = false;
      this.translationPipeline = null;
      return false;
    }
  }

  /**
   * Disconnect from the translation pipeline
   * @returns {Promise<boolean>} - True if disconnection successful
   */
  async disconnectFromPipeline() {
    try {
      if (!this.isConnectedToPipeline || !this.translationPipeline) {
        return true; // Already disconnected
      }

      // Remove event listeners
      if (this.translationPipeline) {
        this.translationPipeline.removeAllListeners('pipelineActivated');
        this.translationPipeline.removeAllListeners('pipelineDeactivated');
        this.translationPipeline.removeAllListeners('pipelineResult');
        this.translationPipeline.removeAllListeners('pipelineError');
      }

      this.translationPipeline = null;
      this.isConnectedToPipeline = false;

      // Emit disconnection event
      this.emit('pipelineDisconnected', {
        success: true,
        timestamp: Date.now(),
      });

      console.log('AudioDeviceManager disconnected from translation pipeline');
      return true;
    } catch (error) {
      this.emit(
        'error',
        new Error(`Failed to disconnect from translation pipeline: ${error.message}`)
      );
      return false;
    }
  }

  /**
   * Send audio data to the translation pipeline
   * @param {Buffer} audioData - Audio data buffer
   * @param {Object} options - Audio options (format, rate, etc.)
   * @returns {Promise<boolean>} - True if send successful
   */
  async sendAudioToPipeline(audioData, options = {}) {
    try {
      if (!this.isConnectedToPipeline || !this.translationPipeline) {
        throw new Error('Not connected to translation pipeline');
      }

      // Add metadata to options
      const audioOptions = {
        ...options,
        source: 'deviceManager',
        sourceDevice: this.activeDevices.input?.name || 'unknown',
        timestamp: Date.now(),
      };

      // Send to pipeline
      await this.translationPipeline.startPipeline(audioData, audioOptions);
      return true;
    } catch (error) {
      this.emit('error', new Error(`Failed to send audio to pipeline: ${error.message}`));
      return false;
    }
  }

  /**
   * Handle pipeline activation event
   * @param {Object} data - Activation data
   * @private
   */
  handlePipelineActivated(data) {
    this.emit('pipelineStatusChanged', {
      status: 'activated',
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle pipeline deactivation event
   * @param {Object} data - Deactivation data
   * @private
   */
  handlePipelineDeactivated(data) {
    this.emit('pipelineStatusChanged', {
      status: 'deactivated',
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle pipeline result event
   * @param {Object} data - Result data
   * @private
   */
  handlePipelineResult(data) {
    // Forward the result event
    this.emit('translationResult', data);
  }

  /**
   * Handle pipeline error event
   * @param {Object} error - Error data
   * @private
   */
  handlePipelineError(error) {
    this.emit('translationError', error);
  }

  /**
   * Get the current pipeline connection status
   * @returns {Object} - Connection status
   */
  getPipelineStatus() {
    return {
      isConnected: this.isConnectedToPipeline,
      pipelineActive: this.translationPipeline ? true : false,
    };
  }

  /**
   * Get current audio routing status
   * @returns {Object} - Current audio routing configuration
   */
  getAudioRoutingStatus() {
    return {
      input: this.activeDevices.input
        ? {
            id: this.activeDevices.input.id,
            name: this.activeDevices.input.name,
            isVirtual: this.activeDevices.input.isVirtual,
          }
        : null,
      output: this.activeDevices.output
        ? {
            id: this.activeDevices.output.id,
            name: this.activeDevices.output.name,
            isVirtual: this.activeDevices.output.isVirtual,
          }
        : null,
      isConnectedToPipeline: this.isConnectedToPipeline,
      pipelineActive: this.translationPipeline?.isActive || false,
    };
  }

  /**
   * Get the active input device
   * @returns {Object|null} - Active input device or null if not set
   */
  getActiveInputDevice() {
    return this.activeDevices.input;
  }

  /**
   * Get the active output device
   * @returns {Object|null} - Active output device or null if not set
   */
  getActiveOutputDevice() {
    return this.activeDevices.output;
  }
}

module.exports = AudioDeviceManager;
