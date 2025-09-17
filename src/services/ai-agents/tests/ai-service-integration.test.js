import { expect } from 'chai';
import sinon from 'sinon';
import { AIServiceIntegration } from '../ai-service-integration.js';
import { TestUtils } from '../../utils/test-utils.js';

/**
 * Integration tests for AIServiceIntegration
 * Tests connection between AI agents and existing Echo services
 * including translation, audio processing, and RTC services
 */
describe('AIServiceIntegration Integration Tests', () => {
  let serviceIntegration;
  let mockConfig;
  let mockServices;
  let testUtils;

  beforeEach(async () => {
    // Setup test utilities
    testUtils = new TestUtils();

    // Mock external services
    mockServices = {
      translationService: {
        initialize: sinon.stub().resolves(),
        translate: sinon.stub().resolves({
          text: 'translated text',
          confidence: 0.95,
          sourceLanguage: 'en',
          targetLanguage: 'es',
        }),
        detectLanguage: sinon.stub().resolves({ language: 'en', confidence: 0.98 }),
        getSupportedLanguages: sinon.stub().returns(['en', 'es', 'fr', 'de']),
        getCapabilities: sinon.stub().returns({
          maxTextLength: 5000,
          supportsBatch: true,
          supportsRealtime: true,
        }),
      },

      audioProcessor: {
        initialize: sinon.stub().resolves(),
        processAudio: sinon.stub().resolves({
          processed: true,
          audioData: new ArrayBuffer(1024),
          format: 'wav',
          sampleRate: 44100,
        }),
        enhanceAudio: sinon.stub().resolves({ enhanced: true }),
        extractFeatures: sinon.stub().resolves({
          features: { pitch: 220, volume: 0.8, clarity: 0.9 },
        }),
        getMetrics: sinon.stub().returns({
          latency: 50,
          quality: 0.9,
          processingTime: 100,
        }),
      },

      rtcService: {
        initialize: sinon.stub().resolves(),
        createConnection: sinon.stub().resolves({ connectionId: 'conn123' }),
        sendMessage: sinon.stub().resolves({ sent: true, messageId: 'msg123' }),
        sendAudio: sinon.stub().resolves({ sent: true, streamId: 'stream123' }),
        getConnectionStatus: sinon.stub().returns({
          connected: true,
          quality: 'good',
          latency: 25,
        }),
        closeConnection: sinon.stub().resolves({ closed: true }),
      },

      echoAIAgent: {
        initialize: sinon.stub().resolves(),
        processMessage: sinon.stub().resolves({
          response: 'AI response',
          confidence: 0.92,
          context: { understood: true },
        }),
        startConversation: sinon.stub().resolves('conv123'),
        endConversation: sinon.stub().resolves({ ended: true }),
        getContext: sinon.stub().returns({ conversationId: 'conv123', history: [] }),
      },
    };

    // Test configuration
    mockConfig = {
      integration: {
        name: 'TestServiceIntegration',
        version: '1.0.0-test',
        enableServiceDiscovery: true,
        enableCircuitBreaker: true,
        enableLoadBalancing: true,
        enableCaching: true,
        enableHealthMonitoring: true,
      },

      services: {
        translation: {
          enabled: true,
          endpoint: 'http://localhost:3001/translation',
          timeout: 5000,
          retries: 3,
          circuitBreaker: {
            failureThreshold: 5,
            resetTimeout: 30000,
          },
        },

        audioProcessing: {
          enabled: true,
          endpoint: 'http://localhost:3002/audio',
          timeout: 10000,
          retries: 2,
          bufferSize: 4096,
          sampleRate: 44100,
        },

        rtc: {
          enabled: true,
          endpoint: 'ws://localhost:3003/rtc',
          timeout: 15000,
          retries: 3,
          connectionPoolSize: 10,
        },

        aiAgent: {
          enabled: true,
          endpoint: 'http://localhost:3004/ai',
          timeout: 8000,
          retries: 2,
          contextWindow: 4096,
        },
      },

      loadBalancing: {
        strategy: 'round_robin',
        healthCheckInterval: 5000,
        maxRetries: 3,
        retryDelay: 1000,
      },

      caching: {
        enabled: true,
        ttl: 300000,
        maxSize: 1000,
        strategy: 'lru',
      },

      monitoring: {
        enabled: true,
        metricsInterval: 10000,
        healthCheckInterval: 5000,
        alertThresholds: {
          responseTime: 5000,
          errorRate: 0.05,
          availability: 0.95,
        },
      },

      serviceInstances: mockServices,
    };

    // Create service integration instance
    serviceIntegration = new AIServiceIntegration(mockConfig);
  });

  afterEach(async () => {
    if (serviceIntegration && serviceIntegration.isRunning) {
      await serviceIntegration.stop();
    }
    await serviceIntegration?.cleanup();
    sinon.restore();
  });

  describe('Initialization and Service Discovery', () => {
    it('should initialize successfully with all services', async () => {
      await serviceIntegration.initialize();

      expect(serviceIntegration.isInitialized).to.be.true;
      expect(serviceIntegration.getStatus().initialized).to.be.true;

      const discoveredServices = serviceIntegration.getDiscoveredServices();
      expect(discoveredServices).to.include.keys([
        'translation',
        'audioProcessing',
        'rtc',
        'aiAgent',
      ]);
    });

    it('should start and stop successfully', async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();

      expect(serviceIntegration.isRunning).to.be.true;
      expect(serviceIntegration.getStatus().running).to.be.true;

      await serviceIntegration.stop();

      expect(serviceIntegration.isRunning).to.be.false;
      expect(serviceIntegration.getStatus().running).to.be.false;
    });

    it('should discover available services', async () => {
      await serviceIntegration.initialize();

      const serviceDiscovery = await serviceIntegration.discoverServices();

      expect(serviceDiscovery).to.exist;
      expect(serviceDiscovery.discovered).to.be.an('array');
      expect(serviceDiscovery.discovered.length).to.be.greaterThan(0);
      expect(serviceDiscovery.healthy).to.be.an('array');
    });

    it('should handle service initialization failures gracefully', async () => {
      // Mock service failure
      mockServices.translationService.initialize.rejects(new Error('Service unavailable'));

      await serviceIntegration.initialize();

      const serviceStatus = serviceIntegration.getServiceStatus();
      expect(serviceStatus.translation.healthy).to.be.false;
      expect(serviceStatus.translation.error).to.exist;
    });

    it('should emit service discovery events', async () => {
      const discoverySpy = sinon.spy();
      const healthSpy = sinon.spy();

      serviceIntegration.on('serviceDiscovered', discoverySpy);
      serviceIntegration.on('serviceHealthChanged', healthSpy);

      await serviceIntegration.initialize();
      await serviceIntegration.start();

      expect(discoverySpy.called).to.be.true;
    });
  });

  describe('Translation Service Integration', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should process translation requests', async () => {
      const translationRequest = {
        text: 'Hello, how are you?',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        context: {
          conversationId: 'conv123',
          userId: 'user123',
        },
      };

      const result = await serviceIntegration.processTranslation(translationRequest);

      expect(result).to.exist;
      expect(result.translated).to.be.true;
      expect(result.text).to.equal('translated text');
      expect(result.confidence).to.equal(0.95);
      expect(result.sourceLanguage).to.equal('en');
      expect(result.targetLanguage).to.equal('es');
    });

    it('should handle batch translation requests', async () => {
      const batchRequest = {
        texts: ['Hello world', 'How are you?', 'Thank you'],
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        batchId: 'batch123',
      };

      const result = await serviceIntegration.processBatchTranslation(batchRequest);

      expect(result).to.exist;
      expect(result.batchProcessed).to.be.true;
      expect(result.results).to.be.an('array');
      expect(result.results.length).to.equal(3);
    });

    it('should detect language automatically', async () => {
      const detectionRequest = {
        text: 'Bonjour, comment allez-vous?',
        context: { userId: 'user123' },
      };

      const result = await serviceIntegration.detectLanguage(detectionRequest);

      expect(result).to.exist;
      expect(result.language).to.equal('en');
      expect(result.confidence).to.equal(0.98);
    });

    it('should cache translation results', async () => {
      const translationRequest = {
        text: 'Cache this translation',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        cacheable: true,
      };

      // First request should hit the service
      const result1 = await serviceIntegration.processTranslation(translationRequest);
      expect(result1.fromCache).to.be.false;

      // Second identical request should hit the cache
      const result2 = await serviceIntegration.processTranslation(translationRequest);
      expect(result2.fromCache).to.be.true;
      expect(result2.text).to.equal(result1.text);
    });

    it('should handle translation service failures with circuit breaker', async () => {
      // Mock repeated failures
      mockServices.translationService.translate.rejects(new Error('Service down'));

      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push({
          text: `Test ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'es',
        });
      }

      const results = [];
      for (const req of requests) {
        try {
          const result = await serviceIntegration.processTranslation(req);
          results.push(result);
        } catch (error) {
          results.push({ error: error.message });
        }
      }

      // Later requests should be blocked by circuit breaker
      const lastResult = results[results.length - 1];
      expect(lastResult.circuitBreakerOpen).to.be.true;
    });
  });

  describe('Audio Processing Integration', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should process audio data', async () => {
      const audioRequest = {
        audioData: new ArrayBuffer(2048),
        format: 'wav',
        sampleRate: 44100,
        channels: 2,
        context: {
          conversationId: 'conv123',
          userId: 'user123',
        },
      };

      const result = await serviceIntegration.processAudio(audioRequest);

      expect(result).to.exist;
      expect(result.processed).to.be.true;
      expect(result.audioData).to.be.instanceOf(ArrayBuffer);
      expect(result.format).to.equal('wav');
      expect(result.sampleRate).to.equal(44100);
    });

    it('should enhance audio quality', async () => {
      const enhancementRequest = {
        audioData: new ArrayBuffer(1024),
        enhancementType: 'noise_reduction',
        parameters: {
          noiseThreshold: 0.1,
          preserveVoice: true,
        },
      };

      const result = await serviceIntegration.enhanceAudio(enhancementRequest);

      expect(result).to.exist;
      expect(result.enhanced).to.be.true;
    });

    it('should extract audio features', async () => {
      const featureRequest = {
        audioData: new ArrayBuffer(4096),
        features: ['pitch', 'volume', 'clarity', 'emotion'],
        analysisDepth: 'detailed',
      };

      const result = await serviceIntegration.extractAudioFeatures(featureRequest);

      expect(result).to.exist;
      expect(result.features).to.exist;
      expect(result.features.pitch).to.equal(220);
      expect(result.features.volume).to.equal(0.8);
      expect(result.features.clarity).to.equal(0.9);
    });

    it('should handle real-time audio streaming', async () => {
      const streamConfig = {
        sampleRate: 44100,
        channels: 1,
        bufferSize: 1024,
        processingMode: 'realtime',
      };

      const stream = await serviceIntegration.createAudioStream(streamConfig);

      expect(stream).to.exist;
      expect(stream.streamId).to.exist;
      expect(stream.ready).to.be.true;

      // Simulate streaming audio data
      const audioChunk = new ArrayBuffer(1024);
      const result = await serviceIntegration.processAudioStream(stream.streamId, audioChunk);

      expect(result.processed).to.be.true;
      expect(result.streamId).to.equal(stream.streamId);
    });

    it('should monitor audio processing performance', async () => {
      // Process some audio to generate metrics
      await serviceIntegration.processAudio({
        audioData: new ArrayBuffer(2048),
        format: 'wav',
        sampleRate: 44100,
      });

      const metrics = serviceIntegration.getAudioProcessingMetrics();

      expect(metrics).to.exist;
      expect(metrics.latency).to.equal(50);
      expect(metrics.quality).to.equal(0.9);
      expect(metrics.processingTime).to.equal(100);
    });
  });

  describe('RTC Service Integration', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should establish RTC connections', async () => {
      const connectionRequest = {
        userId: 'user123',
        roomId: 'room456',
        connectionType: 'peer_to_peer',
        mediaConstraints: {
          audio: true,
          video: false,
        },
      };

      const result = await serviceIntegration.createRTCConnection(connectionRequest);

      expect(result).to.exist;
      expect(result.connectionId).to.equal('conn123');
      expect(result.connected).to.be.true;
    });

    it('should send messages through RTC', async () => {
      // First establish connection
      const connection = await serviceIntegration.createRTCConnection({
        userId: 'user123',
        roomId: 'room456',
      });

      const messageRequest = {
        connectionId: connection.connectionId,
        message: {
          type: 'translation',
          content: 'Hello from AI agent',
          metadata: {
            sourceLanguage: 'en',
            targetLanguage: 'es',
            timestamp: Date.now(),
          },
        },
      };

      const result = await serviceIntegration.sendRTCMessage(messageRequest);

      expect(result).to.exist;
      expect(result.sent).to.be.true;
      expect(result.messageId).to.equal('msg123');
    });

    it('should stream audio through RTC', async () => {
      const connection = await serviceIntegration.createRTCConnection({
        userId: 'user123',
        roomId: 'room456',
      });

      const audioStreamRequest = {
        connectionId: connection.connectionId,
        audioData: new ArrayBuffer(4096),
        format: 'opus',
        sampleRate: 48000,
        streamType: 'realtime',
      };

      const result = await serviceIntegration.sendRTCAudio(audioStreamRequest);

      expect(result).to.exist;
      expect(result.sent).to.be.true;
      expect(result.streamId).to.equal('stream123');
    });

    it('should monitor RTC connection quality', async () => {
      const connection = await serviceIntegration.createRTCConnection({
        userId: 'user123',
        roomId: 'room456',
      });

      const status = serviceIntegration.getRTCConnectionStatus(connection.connectionId);

      expect(status).to.exist;
      expect(status.connected).to.be.true;
      expect(status.quality).to.equal('good');
      expect(status.latency).to.equal(25);
    });

    it('should handle RTC connection failures', async () => {
      // Mock connection failure
      mockServices.rtcService.createConnection.rejects(new Error('Connection failed'));

      try {
        await serviceIntegration.createRTCConnection({
          userId: 'user123',
          roomId: 'room456',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Connection failed');
      }

      // Service should still be operational
      expect(serviceIntegration.isRunning).to.be.true;
    });
  });

  describe('AI Agent Integration', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should process conversations through AI agent', async () => {
      const conversationRequest = {
        message: 'I need help with translation',
        context: {
          userId: 'user123',
          conversationId: 'conv123',
          language: 'en',
          history: [],
        },
        aiParameters: {
          temperature: 0.7,
          maxTokens: 150,
          model: 'gpt-3.5-turbo',
        },
      };

      const result = await serviceIntegration.processConversation(conversationRequest);

      expect(result).to.exist;
      expect(result.response).to.equal('AI response');
      expect(result.confidence).to.equal(0.92);
      expect(result.context.understood).to.be.true;
    });

    it('should start and manage conversation sessions', async () => {
      const sessionRequest = {
        userId: 'user123',
        sessionType: 'translation_assistance',
        initialContext: {
          preferredLanguages: ['en', 'es'],
          domain: 'business',
        },
      };

      const session = await serviceIntegration.startConversationSession(sessionRequest);

      expect(session).to.exist;
      expect(session.conversationId).to.equal('conv123');
      expect(session.active).to.be.true;
    });

    it('should maintain conversation context', async () => {
      const conversationId = 'conv123';

      // Start conversation
      await serviceIntegration.startConversationSession({
        userId: 'user123',
        conversationId,
      });

      // Get context
      const context = serviceIntegration.getConversationContext(conversationId);

      expect(context).to.exist;
      expect(context.conversationId).to.equal('conv123');
      expect(context.history).to.be.an('array');
    });

    it('should end conversation sessions properly', async () => {
      const conversationId = 'conv123';

      // Start conversation
      await serviceIntegration.startConversationSession({
        userId: 'user123',
        conversationId,
      });

      // End conversation
      const result = await serviceIntegration.endConversationSession(conversationId);

      expect(result).to.exist;
      expect(result.ended).to.be.true;
    });
  });

  describe('Service Orchestration', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should orchestrate multi-service workflows', async () => {
      const workflowRequest = {
        workflowId: 'workflow123',
        type: 'translation_with_audio',
        steps: [
          {
            service: 'audioProcessing',
            action: 'extractFeatures',
            input: { audioData: new ArrayBuffer(2048) },
          },
          {
            service: 'translation',
            action: 'detectLanguage',
            input: { text: 'Audio transcription text' },
          },
          {
            service: 'translation',
            action: 'translate',
            input: { text: 'Audio transcription text', targetLanguage: 'es' },
          },
          {
            service: 'rtc',
            action: 'sendMessage',
            input: { message: 'Translated result' },
          },
        ],
      };

      const result = await serviceIntegration.executeWorkflow(workflowRequest);

      expect(result).to.exist;
      expect(result.workflowCompleted).to.be.true;
      expect(result.stepResults).to.have.length(4);
      expect(result.stepResults.every((step) => step.completed)).to.be.true;
    });

    it('should handle workflow failures gracefully', async () => {
      // Mock a service failure in the middle of workflow
      mockServices.translationService.translate.rejects(new Error('Translation failed'));

      const workflowRequest = {
        workflowId: 'workflow_fail',
        type: 'translation_workflow',
        steps: [
          {
            service: 'translation',
            action: 'detectLanguage',
            input: { text: 'Test text' },
          },
          {
            service: 'translation',
            action: 'translate',
            input: { text: 'Test text', targetLanguage: 'es' },
          },
        ],
        failureHandling: 'continue_on_error',
      };

      const result = await serviceIntegration.executeWorkflow(workflowRequest);

      expect(result).to.exist;
      expect(result.workflowCompleted).to.be.false;
      expect(result.failedSteps).to.have.length(1);
      expect(result.stepResults[0].completed).to.be.true;
      expect(result.stepResults[1].error).to.exist;
    });

    it('should support parallel service execution', async () => {
      const parallelRequest = {
        workflowId: 'parallel_workflow',
        type: 'parallel_processing',
        parallelSteps: [
          {
            service: 'audioProcessing',
            action: 'processAudio',
            input: { audioData: new ArrayBuffer(1024) },
          },
          {
            service: 'translation',
            action: 'detectLanguage',
            input: { text: 'Parallel text processing' },
          },
          {
            service: 'aiAgent',
            action: 'processMessage',
            input: { message: 'Parallel AI processing' },
          },
        ],
      };

      const startTime = Date.now();
      const result = await serviceIntegration.executeParallelWorkflow(parallelRequest);
      const executionTime = Date.now() - startTime;

      expect(result).to.exist;
      expect(result.parallelCompleted).to.be.true;
      expect(result.results).to.have.length(3);
      expect(result.results.every((r) => r.completed)).to.be.true;

      // Parallel execution should be faster than sequential
      expect(executionTime).to.be.lessThan(1000);
    });
  });

  describe('Load Balancing and Health Monitoring', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should distribute load across service instances', async () => {
      // Simulate multiple service instances
      const serviceInstances = {
        translation: ['instance1', 'instance2', 'instance3'],
        audioProcessing: ['instance1', 'instance2'],
      };

      serviceIntegration.updateServiceInstances(serviceInstances);

      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push({
          text: `Load test ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'es',
        });
      }

      const results = await Promise.all(
        requests.map((req) => serviceIntegration.processTranslation(req))
      );

      // Check that requests were distributed across instances
      const instancesUsed = new Set(results.map((r) => r.serviceInstance));
      expect(instancesUsed.size).to.be.greaterThan(1);
    });

    it('should monitor service health continuously', async () => {
      const healthSpy = sinon.spy();
      serviceIntegration.on('healthCheck', healthSpy);

      // Trigger health check
      await serviceIntegration.performHealthCheck();

      expect(healthSpy.called).to.be.true;

      const healthStatus = serviceIntegration.getHealthStatus();
      expect(healthStatus).to.exist;
      expect(healthStatus.overall).to.be.a('string');
      expect(healthStatus.services).to.be.an('object');
    });

    it('should remove unhealthy services from load balancer', async () => {
      // Mark a service as unhealthy
      await serviceIntegration.updateServiceHealth('translation', {
        healthy: false,
        lastError: 'Connection timeout',
        errorCount: 5,
      });

      const request = {
        text: 'Test with unhealthy service',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      };

      const result = await serviceIntegration.processTranslation(request);

      // Should use fallback or alternative service
      expect(result.fallbackUsed || result.alternativeService).to.be.true;
    });

    it('should automatically recover unhealthy services', async () => {
      // Mark service as unhealthy
      await serviceIntegration.updateServiceHealth('translation', {
        healthy: false,
        lastError: 'Temporary failure',
      });

      // Simulate service recovery
      mockServices.translationService.translate.resolves({
        text: 'recovered translation',
        confidence: 0.95,
      });

      // Wait for health check cycle
      await testUtils.wait(100);
      await serviceIntegration.performHealthCheck();

      const healthStatus = serviceIntegration.getServiceHealth('translation');
      expect(healthStatus.recovering || healthStatus.healthy).to.be.true;
    });
  });

  describe('Caching and Performance Optimization', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should cache service responses', async () => {
      const cacheableRequest = {
        text: 'Cache this translation',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        cacheable: true,
      };

      // First request should hit the service
      const result1 = await serviceIntegration.processTranslation(cacheableRequest);
      expect(result1.fromCache).to.be.false;

      // Second identical request should hit the cache
      const result2 = await serviceIntegration.processTranslation(cacheableRequest);
      expect(result2.fromCache).to.be.true;
      expect(result2.text).to.equal(result1.text);
    });

    it('should invalidate cache entries based on TTL', async () => {
      // Use short TTL for testing
      const shortTTLConfig = {
        ...mockConfig,
        caching: { ...mockConfig.caching, ttl: 100 },
      };

      const shortTTLIntegration = new AIServiceIntegration(shortTTLConfig);
      await shortTTLIntegration.initialize();
      await shortTTLIntegration.start();

      const request = {
        text: 'TTL test',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        cacheable: true,
      };

      // First request
      await shortTTLIntegration.processTranslation(request);

      // Wait for cache expiry
      await testUtils.wait(150);

      // Second request should not hit cache
      const result = await shortTTLIntegration.processTranslation(request);
      expect(result.fromCache).to.be.false;

      await shortTTLIntegration.stop();
      await shortTTLIntegration.cleanup();
    });

    it('should optimize request routing based on service performance', async () => {
      // Simulate different performance metrics for services
      const performanceMetrics = {
        translation: {
          instance1: { responseTime: 100, errorRate: 0.01 },
          instance2: { responseTime: 200, errorRate: 0.05 },
          instance3: { responseTime: 50, errorRate: 0.001 },
        },
      };

      serviceIntegration.updatePerformanceMetrics(performanceMetrics);

      const request = {
        text: 'Performance optimization test',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      };

      const result = await serviceIntegration.processTranslation(request);

      // Should route to best performing instance (instance3)
      expect(result.serviceInstance).to.equal('instance3');
      expect(result.optimizedRouting).to.be.true;
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should handle individual service failures gracefully', async () => {
      // Mock service failure
      mockServices.translationService.translate.rejects(new Error('Service unavailable'));

      const request = {
        text: 'Test error handling',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      };

      const result = await serviceIntegration.processTranslation(request);

      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(result.fallbackUsed).to.be.true;
    });

    it('should implement retry logic with exponential backoff', async () => {
      let callCount = 0;
      mockServices.translationService.translate.callsFake(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ text: 'success after retries', confidence: 0.9 });
      });

      const request = {
        text: 'Retry test',
        sourceLanguage: 'en',
        targetLanguage: 'es',
      };

      const result = await serviceIntegration.processTranslation(request);

      expect(result.text).to.equal('success after retries');
      expect(result.retryCount).to.be.greaterThan(0);
      expect(callCount).to.equal(3);
    });

    it('should maintain system stability during cascading failures', async () => {
      // Mock failures in multiple services
      mockServices.translationService.translate.rejects(new Error('Translation down'));
      mockServices.audioProcessor.processAudio.rejects(new Error('Audio processing down'));

      const requests = [
        {
          type: 'translation',
          data: { text: 'Test 1', sourceLanguage: 'en', targetLanguage: 'es' },
        },
        {
          type: 'audio',
          data: { audioData: new ArrayBuffer(1024) },
        },
        {
          type: 'conversation',
          data: { message: 'Test conversation' },
        },
      ];

      const results = [];
      for (const req of requests) {
        try {
          let result;
          if (req.type === 'translation') {
            result = await serviceIntegration.processTranslation(req.data);
          } else if (req.type === 'audio') {
            result = await serviceIntegration.processAudio(req.data);
          } else {
            result = await serviceIntegration.processConversation(req.data);
          }
          results.push(result);
        } catch (error) {
          results.push({ error: error.message });
        }
      }

      // System should still be operational
      expect(serviceIntegration.isRunning).to.be.true;

      // At least one service should still work (AI agent)
      const successfulResults = results.filter((r) => !r.error);
      expect(successfulResults.length).to.be.greaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await serviceIntegration.initialize();
      await serviceIntegration.start();
    });

    it('should collect comprehensive service statistics', async () => {
      // Generate varied activity
      const activities = [
        () =>
          serviceIntegration.processTranslation({
            text: 'Test 1',
            sourceLanguage: 'en',
            targetLanguage: 'es',
          }),
        () => serviceIntegration.processAudio({ audioData: new ArrayBuffer(1024) }),
        () => serviceIntegration.processConversation({ message: 'Test conversation' }),
      ];

      await Promise.all(activities.map((activity) => activity()));

      const statistics = serviceIntegration.getStatistics();

      expect(statistics).to.exist;
      expect(statistics.totalRequests).to.be.greaterThan(0);
      expect(statistics.serviceUsage).to.be.an('object');
      expect(statistics.averageResponseTime).to.be.a('number');
      expect(statistics.errorRate).to.be.a('number');
      expect(statistics.uptime).to.be.a('number');
    });

    it('should generate detailed service reports', async () => {
      // Generate activity for reporting
      for (let i = 0; i < 3; i++) {
        await serviceIntegration.processTranslation({
          text: `Report test ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'es',
        });
      }

      const report = serviceIntegration.generateReport({
        timeRange: { start: Date.now() - 3600000, end: Date.now() },
        includeDetails: true,
        services: ['translation', 'audioProcessing', 'rtc', 'aiAgent'],
      });

      expect(report).to.exist;
      expect(report.summary).to.exist;
      expect(report.servicePerformance).to.exist;
      expect(report.healthMetrics).to.exist;
      expect(report.recommendations).to.exist;
    });
  });
});
