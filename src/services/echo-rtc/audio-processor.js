import EventEmitter from 'events';
import { EchoRTCConfig } from './config.js';

/**
 * EchoRTCAudioProcessor - Handles real-time audio processing for echo RTC
 * Manages audio streaming, buffering, quality monitoring, and WebRTC integration
 */
export class EchoRTCAudioProcessor extends EventEmitter {
  constructor(config = null) {
    super();

    this.config = config || EchoRTCConfig.getInstance();
    this.audioConfig = this.config.get('audio');

    // Audio processing state
    this.isProcessing = false;
    this.audioContext = null;
    this.mediaStream = null;
    this.audioWorklet = null;

    // Audio buffers and streams
    this.inputBuffer = [];
    this.outputBuffer = [];
    this.processingQueue = [];

    // Quality monitoring
    this.qualityMetrics = {
      latency: 0,
      jitter: 0,
      packetLoss: 0,
      audioLevel: 0,
      noiseLevel: 0,
      signalToNoise: 0,
    };

    // Processing statistics
    this.stats = {
      processedSamples: 0,
      droppedSamples: 0,
      bufferUnderruns: 0,
      bufferOverruns: 0,
      processingTime: 0,
      startTime: null,
    };

    // Audio nodes and processors
    this.audioNodes = {
      source: null,
      gainNode: null,
      filterNode: null,
      analyzerNode: null,
      destination: null,
    };

    this._setupEventHandlers();
  }

  /**
   * Initialize the audio processor
   */
  async initialize() {
    try {
      console.log('Initializing EchoRTCAudioProcessor...');

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.audioConfig.sampleRate,
        latencyHint: this.audioConfig.latencyHint,
      });

      // Load audio worklet if available
      if (this.audioContext.audioWorklet) {
        await this._loadAudioWorklet();
      }

      // Setup audio nodes
      this._setupAudioNodes();

      // Initialize quality monitoring
      this._initializeQualityMonitoring();

      this.emit('initialized');
      console.log('EchoRTCAudioProcessor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start audio processing
   */
  async startProcessing(mediaStream) {
    try {
      if (this.isProcessing) {
        console.warn('Audio processing already started');
        return;
      }

      console.log('Starting audio processing...');

      this.mediaStream = mediaStream;
      this.isProcessing = true;
      this.stats.startTime = Date.now();

      // Connect media stream to audio context
      this.audioNodes.source = this.audioContext.createMediaStreamSource(mediaStream);

      // Setup audio processing chain
      this._setupProcessingChain();

      // Start quality monitoring
      this._startQualityMonitoring();

      // Start processing loop
      this._startProcessingLoop();

      this.emit('processingStarted', { mediaStream });
      console.log('Audio processing started successfully');
    } catch (error) {
      console.error('Failed to start audio processing:', error);
      this.isProcessing = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop audio processing
   */
  async stopProcessing() {
    try {
      if (!this.isProcessing) {
        console.warn('Audio processing not started');
        return;
      }

      console.log('Stopping audio processing...');

      this.isProcessing = false;

      // Disconnect audio nodes
      if (this.audioNodes.source) {
        this.audioNodes.source.disconnect();
        this.audioNodes.source = null;
      }

      // Clear buffers
      this.inputBuffer = [];
      this.outputBuffer = [];
      this.processingQueue = [];

      // Stop quality monitoring
      this._stopQualityMonitoring();

      this.emit('processingStopped');
      console.log('Audio processing stopped');
    } catch (error) {
      console.error('Failed to stop audio processing:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process audio chunk for translation
   */
  async processAudioChunk(audioData, options = {}) {
    try {
      if (!this.isProcessing) {
        throw new Error('Audio processor not started');
      }

      const startTime = performance.now();

      // Add to processing queue
      const chunk = {
        id: Date.now() + Math.random(),
        data: audioData,
        timestamp: Date.now(),
        options: {
          language: options.language || 'auto',
          targetLanguage: options.targetLanguage,
          priority: options.priority || 'normal',
          ...options,
        },
      };

      this.processingQueue.push(chunk);

      // Process chunk
      const processedChunk = await this._processChunk(chunk);

      // Update statistics
      const processingTime = performance.now() - startTime;
      this.stats.processingTime += processingTime;
      this.stats.processedSamples += audioData.length;

      this.emit('chunkProcessed', {
        chunk: processedChunk,
        processingTime,
      });

      return processedChunk;
    } catch (error) {
      console.error('Failed to process audio chunk:', error);
      this.stats.droppedSamples += audioData.length;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get current audio quality metrics
   */
  getQualityMetrics() {
    return { ...this.qualityMetrics };
  }

  /**
   * Get processing statistics
   */
  getStatistics() {
    const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;

    return {
      ...this.stats,
      runtime,
      averageProcessingTime:
        this.stats.processedSamples > 0
          ? this.stats.processingTime / this.stats.processedSamples
          : 0,
      throughput: runtime > 0 ? (this.stats.processedSamples / runtime) * 1000 : 0,
    };
  }

  /**
   * Update audio configuration
   */
  updateConfig(newConfig) {
    try {
      const wasProcessing = this.isProcessing;

      if (wasProcessing) {
        this.stopProcessing();
      }

      // Update configuration
      Object.assign(this.audioConfig, newConfig);

      // Reinitialize if needed
      if (wasProcessing) {
        this.startProcessing(this.mediaStream);
      }

      this.emit('configUpdated', newConfig);
    } catch (error) {
      console.error('Failed to update audio config:', error);
      this.emit('error', error);
    }
  }

  /**
   * Setup event handlers
   */
  _setupEventHandlers() {
    // Handle audio context state changes
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Load audio worklet for advanced processing
   */
  async _loadAudioWorklet() {
    try {
      // Note: In a real implementation, you would load an actual worklet file
      // await this.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');
      console.log('Audio worklet support detected (worklet loading skipped in demo)');
    } catch (error) {
      console.warn('Failed to load audio worklet:', error);
    }
  }

  /**
   * Setup audio nodes
   */
  _setupAudioNodes() {
    // Create gain node for volume control
    this.audioNodes.gainNode = this.audioContext.createGain();
    this.audioNodes.gainNode.gain.value = this.audioConfig.inputGain || 1.0;

    // Create filter node for noise reduction
    this.audioNodes.filterNode = this.audioContext.createBiquadFilter();
    this.audioNodes.filterNode.type = 'highpass';
    this.audioNodes.filterNode.frequency.value = this.audioConfig.highpassFreq || 80;

    // Create analyzer node for quality monitoring
    this.audioNodes.analyzerNode = this.audioContext.createAnalyser();
    this.audioNodes.analyzerNode.fftSize = 2048;
    this.audioNodes.analyzerNode.smoothingTimeConstant = 0.8;
  }

  /**
   * Setup audio processing chain
   */
  _setupProcessingChain() {
    // Connect audio nodes: source -> gain -> filter -> analyzer -> destination
    this.audioNodes.source.connect(this.audioNodes.gainNode);
    this.audioNodes.gainNode.connect(this.audioNodes.filterNode);
    this.audioNodes.filterNode.connect(this.audioNodes.analyzerNode);

    // Create destination for processed audio
    this.audioNodes.destination = this.audioContext.createMediaStreamDestination();
    this.audioNodes.analyzerNode.connect(this.audioNodes.destination);
  }

  /**
   * Initialize quality monitoring
   */
  _initializeQualityMonitoring() {
    this.qualityMonitoringInterval = null;
    this.lastQualityCheck = Date.now();
  }

  /**
   * Start quality monitoring
   */
  _startQualityMonitoring() {
    this.qualityMonitoringInterval = setInterval(() => {
      this._updateQualityMetrics();
    }, this.audioConfig.qualityCheckInterval || 1000);
  }

  /**
   * Stop quality monitoring
   */
  _stopQualityMonitoring() {
    if (this.qualityMonitoringInterval) {
      clearInterval(this.qualityMonitoringInterval);
      this.qualityMonitoringInterval = null;
    }
  }

  /**
   * Update quality metrics
   */
  _updateQualityMetrics() {
    try {
      if (!this.audioNodes.analyzerNode) return;

      const bufferLength = this.audioNodes.analyzerNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Get frequency data
      this.audioNodes.analyzerNode.getByteFrequencyData(dataArray);

      // Calculate audio level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      this.qualityMetrics.audioLevel = sum / bufferLength;

      // Estimate noise level (low frequencies)
      let noiseSum = 0;
      const noiseRange = Math.floor(bufferLength * 0.1); // First 10% of frequencies
      for (let i = 0; i < noiseRange; i++) {
        noiseSum += dataArray[i];
      }
      this.qualityMetrics.noiseLevel = noiseSum / noiseRange;

      // Calculate signal-to-noise ratio
      this.qualityMetrics.signalToNoise =
        this.qualityMetrics.noiseLevel > 0
          ? this.qualityMetrics.audioLevel / this.qualityMetrics.noiseLevel
          : 0;

      // Update latency (simplified estimation)
      this.qualityMetrics.latency = this.audioContext.baseLatency * 1000; // Convert to ms

      this.emit('qualityUpdated', this.qualityMetrics);
    } catch (error) {
      console.error('Failed to update quality metrics:', error);
    }
  }

  /**
   * Start processing loop
   */
  _startProcessingLoop() {
    const processLoop = () => {
      if (!this.isProcessing) return;

      try {
        // Process queued chunks
        while (this.processingQueue.length > 0) {
          const chunk = this.processingQueue.shift();
          this._processChunkInternal(chunk);
        }

        // Schedule next iteration
        requestAnimationFrame(processLoop);
      } catch (error) {
        console.error('Error in processing loop:', error);
        this.emit('error', error);
      }
    };

    requestAnimationFrame(processLoop);
  }

  /**
   * Process individual chunk
   */
  async _processChunk(chunk) {
    // Apply audio processing (noise reduction, normalization, etc.)
    const processedData = this._applyAudioProcessing(chunk.data);

    return {
      ...chunk,
      data: processedData,
      processedAt: Date.now(),
    };
  }

  /**
   * Internal chunk processing
   */
  _processChunkInternal(chunk) {
    try {
      // Buffer management
      if (this.inputBuffer.length > this.audioConfig.maxBufferSize) {
        this.inputBuffer.shift(); // Remove oldest
        this.stats.bufferOverruns++;
      }

      this.inputBuffer.push(chunk);

      // Emit chunk for further processing
      this.emit('chunkReady', chunk);
    } catch (error) {
      console.error('Error processing chunk internally:', error);
      this.stats.droppedSamples += chunk.data.length;
    }
  }

  /**
   * Apply audio processing algorithms
   */
  _applyAudioProcessing(audioData) {
    try {
      let processedData = new Float32Array(audioData);

      // Apply gain normalization
      const gain = this.audioConfig.inputGain || 1.0;
      for (let i = 0; i < processedData.length; i++) {
        processedData[i] *= gain;
      }

      // Apply simple noise gate
      const noiseGate = this.audioConfig.noiseGate || 0.01;
      for (let i = 0; i < processedData.length; i++) {
        if (Math.abs(processedData[i]) < noiseGate) {
          processedData[i] = 0;
        }
      }

      return processedData;
    } catch (error) {
      console.error('Error applying audio processing:', error);
      return audioData; // Return original data on error
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      console.log('Cleaning up EchoRTCAudioProcessor...');

      await this.stopProcessing();

      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }

      // Clear all buffers
      this.inputBuffer = [];
      this.outputBuffer = [];
      this.processingQueue = [];

      // Reset state
      this.audioContext = null;
      this.mediaStream = null;
      this.audioNodes = {};

      this.emit('cleanup');
      console.log('EchoRTCAudioProcessor cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.emit('error', error);
    }
  }
}

export default EchoRTCAudioProcessor;
