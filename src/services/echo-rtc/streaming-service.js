import EventEmitter from 'events';
import { EchoRTCConfig } from './config.js';

/**
 * StreamingService - Handles real-time audio streaming and buffering for echo RTC
 * Manages audio streams, buffering strategies, and quality optimization
 */
export class StreamingService extends EventEmitter {
  constructor(config = null) {
    super();

    this.config = config || EchoRTCConfig.getInstance();
    this.streamingConfig = this.config.get('audio');

    // Streaming state
    this.isStreaming = false;
    this.activeStreams = new Map();
    this.streamBuffers = new Map();

    // Buffer management
    this.bufferConfig = {
      minBufferSize: this.streamingConfig.minBufferSize || 1024,
      maxBufferSize: this.streamingConfig.maxBufferSize || 8192,
      targetBufferSize: this.streamingConfig.targetBufferSize || 4096,
      bufferTimeout: this.streamingConfig.bufferTimeout || 100,
      adaptiveBuffering: this.streamingConfig.adaptiveBuffering || true,
    };

    // Quality management
    this.qualityController = {
      targetLatency: this.streamingConfig.targetLatency || 150,
      maxLatency: this.streamingConfig.maxLatency || 300,
      qualityLevels: ['low', 'medium', 'high', 'ultra'],
      currentQuality: 'high',
      adaptiveQuality: this.streamingConfig.adaptiveQuality || true,
    };

    // Streaming statistics
    this.stats = {
      totalStreams: 0,
      activeStreamCount: 0,
      totalBytesStreamed: 0,
      totalBufferUnderruns: 0,
      totalBufferOverruns: 0,
      averageLatency: 0,
      averageThroughput: 0,
      startTime: null,
    };

    // Performance monitoring
    this.performanceMetrics = {
      latency: 0,
      jitter: 0,
      packetLoss: 0,
      throughput: 0,
      bufferHealth: 100,
      qualityScore: 100,
    };

    this._setupEventHandlers();
  }

  /**
   * Initialize the streaming service
   */
  async initialize() {
    try {
      console.log('Initializing StreamingService...');

      // Initialize buffer management
      this._initializeBufferManagement();

      // Initialize quality controller
      this._initializeQualityController();

      // Initialize performance monitoring
      this._initializePerformanceMonitoring();

      // Setup adaptive algorithms
      this._setupAdaptiveAlgorithms();

      this.stats.startTime = Date.now();

      this.emit('initialized');
      console.log('StreamingService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize streaming service:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start streaming for a session
   */
  async startStreaming(streamConfig) {
    try {
      console.log('Starting streaming...', streamConfig);

      const streamId = streamConfig.streamId || this._generateStreamId();

      // Create stream context
      const stream = {
        id: streamId,
        sessionId: streamConfig.sessionId,
        mediaStream: streamConfig.mediaStream,
        config: streamConfig,
        startTime: Date.now(),
        status: 'active',
        buffer: {
          input: [],
          output: [],
          size: 0,
          maxSize: this.bufferConfig.maxBufferSize,
        },
        metrics: {
          bytesStreamed: 0,
          packetsProcessed: 0,
          bufferUnderruns: 0,
          bufferOverruns: 0,
          averageLatency: 0,
          lastPacketTime: Date.now(),
        },
      };

      this.activeStreams.set(streamId, stream);
      this.streamBuffers.set(streamId, stream.buffer);

      // Setup stream processing
      this._setupStreamProcessing(stream);

      // Start buffer management for this stream
      this._startBufferManagement(stream);

      // Start quality monitoring for this stream
      this._startStreamQualityMonitoring(stream);

      this.stats.totalStreams++;
      this.stats.activeStreamCount++;
      this.isStreaming = true;

      this.emit('streamingStarted', { streamId, config: streamConfig });
      console.log('Streaming started successfully for stream:', streamId);

      return streamId;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop streaming for a session
   */
  async stopStreaming(streamId) {
    try {
      console.log('Stopping streaming...', streamId);

      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        console.warn('Stream not found:', streamId);
        return;
      }

      stream.status = 'stopping';
      stream.endTime = Date.now();

      // Stop stream processing
      this._stopStreamProcessing(stream);

      // Clear stream buffer
      this._clearStreamBuffer(stream);

      // Remove stream
      this.activeStreams.delete(streamId);
      this.streamBuffers.delete(streamId);

      this.stats.activeStreamCount--;

      // Stop streaming if no active streams
      if (this.activeStreams.size === 0) {
        this.isStreaming = false;
      }

      this.emit('streamingStopped', { streamId });
      console.log('Streaming stopped for stream:', streamId);
    } catch (error) {
      console.error('Failed to stop streaming:', error);
      this.emit('error', error);
    }
  }

  /**
   * Stream audio data
   */
  async streamAudio(streamId, audioData, options = {}) {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream || stream.status !== 'active') {
        throw new Error('Stream not active: ' + streamId);
      }

      const startTime = performance.now();

      // Create audio packet
      const packet = {
        id: Date.now() + Math.random(),
        streamId,
        data: audioData,
        timestamp: Date.now(),
        size: audioData.length,
        options: {
          priority: options.priority || 'normal',
          quality: options.quality || this.qualityController.currentQuality,
          ...options,
        },
      };

      // Add to stream buffer
      const buffered = await this._bufferAudioPacket(stream, packet);

      if (buffered) {
        // Process buffered audio
        await this._processBufferedAudio(stream);

        // Update stream metrics
        stream.metrics.bytesStreamed += audioData.length;
        stream.metrics.packetsProcessed++;
        stream.metrics.lastPacketTime = Date.now();

        const latency = performance.now() - startTime;
        stream.metrics.averageLatency =
          (stream.metrics.averageLatency * (stream.metrics.packetsProcessed - 1) + latency) /
          stream.metrics.packetsProcessed;

        // Update global statistics
        this.stats.totalBytesStreamed += audioData.length;
        this._updatePerformanceMetrics(stream, latency);

        this.emit('audioStreamed', {
          streamId,
          packet,
          latency,
          bufferSize: stream.buffer.size,
        });

        return {
          success: true,
          packetId: packet.id,
          latency,
          bufferSize: stream.buffer.size,
        };
      } else {
        throw new Error('Failed to buffer audio packet');
      }
    } catch (error) {
      console.error('Failed to stream audio:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get streaming statistics
   */
  getStatistics() {
    const runtime = this.stats.startTime ? Date.now() - this.stats.startTime : 0;

    return {
      ...this.stats,
      runtime,
      averageThroughput: runtime > 0 ? (this.stats.totalBytesStreamed / runtime) * 1000 : 0,
      bufferUtilization: this._calculateBufferUtilization(),
      qualityMetrics: this.performanceMetrics,
      activeStreams: Array.from(this.activeStreams.values()).map((stream) => ({
        id: stream.id,
        sessionId: stream.sessionId,
        status: stream.status,
        metrics: stream.metrics,
        bufferSize: stream.buffer.size,
      })),
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      bufferHealth: this._calculateBufferHealth(),
      qualityScore: this._calculateQualityScore(),
    };
  }

  /**
   * Update streaming configuration
   */
  updateConfiguration(newConfig) {
    try {
      console.log('Updating streaming configuration...', newConfig);

      // Update buffer configuration
      if (newConfig.buffer) {
        Object.assign(this.bufferConfig, newConfig.buffer);
        this._updateBufferConfiguration();
      }

      // Update quality configuration
      if (newConfig.quality) {
        Object.assign(this.qualityController, newConfig.quality);
        this._updateQualityConfiguration();
      }

      // Update streaming configuration
      if (newConfig.streaming) {
        Object.assign(this.streamingConfig, newConfig.streaming);
      }

      this.emit('configurationUpdated', newConfig);
    } catch (error) {
      console.error('Failed to update streaming configuration:', error);
      this.emit('error', error);
    }
  }

  /**
   * Setup event handlers
   */
  _setupEventHandlers() {
    // Handle cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * Initialize buffer management
   */
  _initializeBufferManagement() {
    this.bufferManager = {
      checkInterval: this.bufferConfig.bufferTimeout,
      adaptiveThreshold: 0.8,

      checkBufferHealth: (buffer) => {
        const utilization = buffer.size / buffer.maxSize;
        return {
          utilization,
          health: utilization < this.bufferManager.adaptiveThreshold ? 'good' : 'warning',
          needsAdjustment: utilization > 0.9 || utilization < 0.1,
        };
      },
    };
  }

  /**
   * Initialize quality controller
   */
  _initializeQualityController() {
    this.qualityController.adjustQuality = (metrics) => {
      if (!this.qualityController.adaptiveQuality) return;

      const { latency, packetLoss, bufferHealth } = metrics;

      if (latency > this.qualityController.maxLatency || packetLoss > 5 || bufferHealth < 50) {
        this._decreaseQuality();
      } else if (
        latency < this.qualityController.targetLatency &&
        packetLoss < 1 &&
        bufferHealth > 80
      ) {
        this._increaseQuality();
      }
    };
  }

  /**
   * Initialize performance monitoring
   */
  _initializePerformanceMonitoring() {
    this.performanceMonitoringInterval = setInterval(() => {
      this._updateGlobalPerformanceMetrics();
    }, 1000);
  }

  /**
   * Setup adaptive algorithms
   */
  _setupAdaptiveAlgorithms() {
    this.adaptiveAlgorithms = {
      bufferSizeAdjustment: (stream, metrics) => {
        if (!this.bufferConfig.adaptiveBuffering) return;

        const { latency, bufferUnderruns, bufferOverruns } = metrics;

        if (bufferUnderruns > 0 && stream.buffer.maxSize < this.bufferConfig.maxBufferSize) {
          stream.buffer.maxSize = Math.min(
            stream.buffer.maxSize * 1.2,
            this.bufferConfig.maxBufferSize
          );
        } else if (bufferOverruns > 0 && stream.buffer.maxSize > this.bufferConfig.minBufferSize) {
          stream.buffer.maxSize = Math.max(
            stream.buffer.maxSize * 0.8,
            this.bufferConfig.minBufferSize
          );
        }
      },
    };
  }

  /**
   * Setup stream processing
   */
  _setupStreamProcessing(stream) {
    stream.processingInterval = setInterval(() => {
      this._processStreamBuffer(stream);
    }, this.bufferConfig.bufferTimeout);
  }

  /**
   * Stop stream processing
   */
  _stopStreamProcessing(stream) {
    if (stream.processingInterval) {
      clearInterval(stream.processingInterval);
      stream.processingInterval = null;
    }
  }

  /**
   * Start buffer management for stream
   */
  _startBufferManagement(stream) {
    stream.bufferCheckInterval = setInterval(() => {
      const health = this.bufferManager.checkBufferHealth(stream.buffer);

      if (health.needsAdjustment) {
        this.adaptiveAlgorithms.bufferSizeAdjustment(stream, stream.metrics);
      }

      this.emit('bufferHealthCheck', {
        streamId: stream.id,
        health,
        bufferSize: stream.buffer.size,
      });
    }, this.bufferManager.checkInterval);
  }

  /**
   * Start quality monitoring for stream
   */
  _startStreamQualityMonitoring(stream) {
    stream.qualityCheckInterval = setInterval(() => {
      const metrics = this._calculateStreamMetrics(stream);
      this.qualityController.adjustQuality(metrics);

      this.emit('streamQualityUpdate', {
        streamId: stream.id,
        metrics,
      });
    }, 2000);
  }

  /**
   * Buffer audio packet
   */
  async _bufferAudioPacket(stream, packet) {
    try {
      // Check buffer capacity
      if (stream.buffer.size >= stream.buffer.maxSize) {
        // Buffer overflow - remove oldest packet
        if (stream.buffer.input.length > 0) {
          const removed = stream.buffer.input.shift();
          stream.buffer.size -= removed.size;
          stream.metrics.bufferOverruns++;
          this.stats.totalBufferOverruns++;
        }
      }

      // Add packet to buffer
      stream.buffer.input.push(packet);
      stream.buffer.size += packet.size;

      return true;
    } catch (error) {
      console.error('Failed to buffer audio packet:', error);
      return false;
    }
  }

  /**
   * Process buffered audio
   */
  async _processBufferedAudio(stream) {
    try {
      // Check if we have enough buffered data
      if (stream.buffer.size < this.bufferConfig.minBufferSize) {
        return;
      }

      // Process packets in order
      while (
        stream.buffer.input.length > 0 &&
        stream.buffer.size >= this.bufferConfig.targetBufferSize
      ) {
        const packet = stream.buffer.input.shift();
        stream.buffer.size -= packet.size;

        // Emit processed packet
        this.emit('audioPacketProcessed', {
          streamId: stream.id,
          packet,
          bufferSize: stream.buffer.size,
        });
      }
    } catch (error) {
      console.error('Failed to process buffered audio:', error);
    }
  }

  /**
   * Process stream buffer
   */
  _processStreamBuffer(stream) {
    try {
      // Check for buffer underrun
      if (stream.buffer.size < this.bufferConfig.minBufferSize) {
        stream.metrics.bufferUnderruns++;
        this.stats.totalBufferUnderruns++;

        this.emit('bufferUnderrun', {
          streamId: stream.id,
          bufferSize: stream.buffer.size,
        });
      }

      // Process available packets
      this._processBufferedAudio(stream);
    } catch (error) {
      console.error('Error processing stream buffer:', error);
    }
  }

  /**
   * Clear stream buffer
   */
  _clearStreamBuffer(stream) {
    stream.buffer.input = [];
    stream.buffer.output = [];
    stream.buffer.size = 0;
  }

  /**
   * Update performance metrics
   */
  _updatePerformanceMetrics(stream, latency) {
    // Update latency
    this.performanceMetrics.latency = (this.performanceMetrics.latency + latency) / 2;

    // Calculate jitter
    const jitter = Math.abs(latency - this.performanceMetrics.latency);
    this.performanceMetrics.jitter = (this.performanceMetrics.jitter + jitter) / 2;

    // Update throughput
    const runtime = Date.now() - this.stats.startTime;
    this.performanceMetrics.throughput =
      runtime > 0 ? (this.stats.totalBytesStreamed / runtime) * 1000 : 0;
  }

  /**
   * Update global performance metrics
   */
  _updateGlobalPerformanceMetrics() {
    try {
      // Calculate buffer health
      this.performanceMetrics.bufferHealth = this._calculateBufferHealth();

      // Calculate quality score
      this.performanceMetrics.qualityScore = this._calculateQualityScore();

      // Emit performance update
      this.emit('performanceMetricsUpdated', this.performanceMetrics);
    } catch (error) {
      console.error('Error updating global performance metrics:', error);
    }
  }

  /**
   * Calculate buffer utilization
   */
  _calculateBufferUtilization() {
    if (this.activeStreams.size === 0) return 0;

    let totalUtilization = 0;
    for (const stream of this.activeStreams.values()) {
      totalUtilization += (stream.buffer.size / stream.buffer.maxSize) * 100;
    }

    return totalUtilization / this.activeStreams.size;
  }

  /**
   * Calculate buffer health
   */
  _calculateBufferHealth() {
    const utilization = this._calculateBufferUtilization();

    if (utilization < 20 || utilization > 90) {
      return Math.max(0, 100 - Math.abs(utilization - 50));
    }

    return 100;
  }

  /**
   * Calculate quality score
   */
  _calculateQualityScore() {
    const latencyScore = Math.max(0, 100 - this.performanceMetrics.latency / 10);
    const jitterScore = Math.max(0, 100 - this.performanceMetrics.jitter / 5);
    const bufferScore = this.performanceMetrics.bufferHealth;

    return (latencyScore + jitterScore + bufferScore) / 3;
  }

  /**
   * Calculate stream metrics
   */
  _calculateStreamMetrics(stream) {
    return {
      latency: stream.metrics.averageLatency,
      packetLoss: 0, // Simplified for demo
      bufferHealth: (stream.buffer.size / stream.buffer.maxSize) * 100,
      throughput: (stream.metrics.bytesStreamed / (Date.now() - stream.startTime)) * 1000,
    };
  }

  /**
   * Decrease quality
   */
  _decreaseQuality() {
    const currentIndex = this.qualityController.qualityLevels.indexOf(
      this.qualityController.currentQuality
    );

    if (currentIndex > 0) {
      this.qualityController.currentQuality =
        this.qualityController.qualityLevels[currentIndex - 1];

      this.emit('qualityAdjusted', {
        newQuality: this.qualityController.currentQuality,
        direction: 'decreased',
      });
    }
  }

  /**
   * Increase quality
   */
  _increaseQuality() {
    const currentIndex = this.qualityController.qualityLevels.indexOf(
      this.qualityController.currentQuality
    );

    if (currentIndex < this.qualityController.qualityLevels.length - 1) {
      this.qualityController.currentQuality =
        this.qualityController.qualityLevels[currentIndex + 1];

      this.emit('qualityAdjusted', {
        newQuality: this.qualityController.currentQuality,
        direction: 'increased',
      });
    }
  }

  /**
   * Generate stream ID
   */
  _generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      console.log('Cleaning up StreamingService...');

      // Stop all active streams
      const streamIds = Array.from(this.activeStreams.keys());
      for (const id of streamIds) {
        await this.stopStreaming(id);
      }

      // Stop performance monitoring
      if (this.performanceMonitoringInterval) {
        clearInterval(this.performanceMonitoringInterval);
        this.performanceMonitoringInterval = null;
      }

      // Clear all data
      this.activeStreams.clear();
      this.streamBuffers.clear();

      this.isStreaming = false;

      this.emit('cleanup');
      console.log('StreamingService cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.emit('error', error);
    }
  }
}

export default StreamingService;
