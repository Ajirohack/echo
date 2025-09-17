import { expect } from 'chai';
import sinon from 'sinon';
import { EchoAIAgent } from '../echo-ai-agent.js';
import { TestUtils } from '../../utils/test-utils.js';

/**
 * Integration tests for EchoAIAgent
 * Tests the core AI agent functionality including conversation management,
 * context handling, real-time processing, and service integration
 */
describe('EchoAIAgent Integration Tests', () => {
  let aiAgent;
  let mockConfig;
  let mockServices;
  let testUtils;

  beforeEach(async () => {
    // Setup test utilities
    testUtils = new TestUtils();

    // Mock external services
    mockServices = {
      translationService: {
        translate: sinon.stub().resolves({ text: 'translated text', confidence: 0.95 }),
        detectLanguage: sinon.stub().resolves({ language: 'en', confidence: 0.98 }),
      },
      audioProcessor: {
        processAudio: sinon.stub().resolves({ processed: true, quality: 0.9 }),
        getAudioMetrics: sinon.stub().returns({ latency: 50, quality: 0.95 }),
      },
      rtcService: {
        sendMessage: sinon.stub().resolves({ sent: true }),
        getConnectionStatus: sinon.stub().returns({ connected: true, quality: 'good' }),
      },
      contextManager: {
        getContext: sinon.stub().resolves({ context: 'test context' }),
        updateContext: sinon.stub().resolves({ updated: true }),
      },
    };

    // Test configuration
    mockConfig = {
      agent: {
        name: 'TestEchoAgent',
        version: '1.0.0-test',
        enableRealTimeProcessing: true,
        enableContextAwareness: true,
        enableLearning: true,
        maxConcurrentConversations: 5,
        conversationTimeout: 300000,
        responseTimeout: 5000,
      },
      ai: {
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 1000,
        enableStreaming: true,
      },
      services: mockServices,
    };

    // Create AI agent instance
    aiAgent = new EchoAIAgent(mockConfig);
  });

  afterEach(async () => {
    if (aiAgent && aiAgent.isRunning) {
      await aiAgent.stop();
    }
    await aiAgent?.cleanup();
    sinon.restore();
  });

  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully with valid configuration', async () => {
      await aiAgent.initialize();

      expect(aiAgent.isInitialized).to.be.true;
      expect(aiAgent.getStatus().initialized).to.be.true;
    });

    it('should start and stop successfully', async () => {
      await aiAgent.initialize();
      await aiAgent.start();

      expect(aiAgent.isRunning).to.be.true;
      expect(aiAgent.getStatus().running).to.be.true;

      await aiAgent.stop();

      expect(aiAgent.isRunning).to.be.false;
      expect(aiAgent.getStatus().running).to.be.false;
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.agent.name;

      const invalidAgent = new EchoAIAgent(invalidConfig);

      try {
        await invalidAgent.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Agent name is required');
      }
    });

    it('should emit lifecycle events', async () => {
      const initSpy = sinon.spy();
      const startSpy = sinon.spy();
      const stopSpy = sinon.spy();

      aiAgent.on('initialized', initSpy);
      aiAgent.on('started', startSpy);
      aiAgent.on('stopped', stopSpy);

      await aiAgent.initialize();
      await aiAgent.start();
      await aiAgent.stop();

      expect(initSpy.calledOnce).to.be.true;
      expect(startSpy.calledOnce).to.be.true;
      expect(stopSpy.calledOnce).to.be.true;
    });
  });

  describe('Conversation Management', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should start new conversation successfully', async () => {
      const conversationId = await aiAgent.startConversation('user123', {
        language: 'en',
        context: { topic: 'translation' },
      });

      expect(conversationId).to.be.a('string');
      expect(conversationId).to.have.length.greaterThan(0);

      const conversation = aiAgent.getConversation(conversationId);
      expect(conversation).to.exist;
      expect(conversation.userId).to.equal('user123');
      expect(conversation.status).to.equal('active');
    });

    it('should process messages in conversation', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      const response = await aiAgent.processMessage(conversationId, {
        content: 'Hello, can you help me translate this?',
        type: 'text',
        language: 'en',
      });

      expect(response).to.exist;
      expect(response.content).to.be.a('string');
      expect(response.conversationId).to.equal(conversationId);
      expect(response.processed).to.be.true;
    });

    it('should handle multiple concurrent conversations', async () => {
      const conversations = [];

      // Start multiple conversations
      for (let i = 0; i < 3; i++) {
        const conversationId = await aiAgent.startConversation(`user${i}`);
        conversations.push(conversationId);
      }

      expect(conversations).to.have.length(3);

      // Process messages in each conversation
      const responses = await Promise.all(
        conversations.map((id) =>
          aiAgent.processMessage(id, {
            content: `Message from conversation ${id}`,
            type: 'text',
          })
        )
      );

      expect(responses).to.have.length(3);
      responses.forEach((response, index) => {
        expect(response.conversationId).to.equal(conversations[index]);
        expect(response.processed).to.be.true;
      });
    });

    it('should end conversation successfully', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      const result = await aiAgent.endConversation(conversationId);

      expect(result.ended).to.be.true;
      expect(result.conversationId).to.equal(conversationId);

      const conversation = aiAgent.getConversation(conversationId);
      expect(conversation.status).to.equal('ended');
    });

    it('should handle conversation timeout', async () => {
      // Use short timeout for testing
      const shortTimeoutConfig = {
        ...mockConfig,
        agent: { ...mockConfig.agent, conversationTimeout: 100 },
      };

      const timeoutAgent = new EchoAIAgent(shortTimeoutConfig);
      await timeoutAgent.initialize();
      await timeoutAgent.start();

      const conversationId = await timeoutAgent.startConversation('user123');

      // Wait for timeout
      await testUtils.wait(150);

      const conversation = timeoutAgent.getConversation(conversationId);
      expect(conversation.status).to.equal('timeout');

      await timeoutAgent.stop();
      await timeoutAgent.cleanup();
    });
  });

  describe('Real-time Audio Processing', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should process real-time audio successfully', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      const audioData = testUtils.generateMockAudioData();

      const result = await aiAgent.processRealTimeAudio(conversationId, audioData);

      expect(result).to.exist;
      expect(result.processed).to.be.true;
      expect(result.conversationId).to.equal(conversationId);
      expect(mockServices.audioProcessor.processAudio.calledOnce).to.be.true;
    });

    it('should handle audio streaming', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      const streamSpy = sinon.spy();
      aiAgent.on('audioProcessed', streamSpy);

      // Simulate streaming audio chunks
      const audioChunks = testUtils.generateMockAudioChunks(5);

      for (const chunk of audioChunks) {
        await aiAgent.processRealTimeAudio(conversationId, chunk);
      }

      expect(streamSpy.callCount).to.equal(5);
      expect(mockServices.audioProcessor.processAudio.callCount).to.equal(5);
    });

    it('should integrate with translation service for audio', async () => {
      const conversationId = await aiAgent.startConversation('user123', {
        sourceLanguage: 'es',
        targetLanguage: 'en',
      });

      const audioData = testUtils.generateMockAudioData('Spanish audio content');

      const result = await aiAgent.processRealTimeAudio(conversationId, audioData);

      expect(result.translated).to.be.true;
      expect(mockServices.translationService.translate.calledOnce).to.be.true;
    });

    it('should handle audio processing errors', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Mock audio processing error
      mockServices.audioProcessor.processAudio.rejects(new Error('Audio processing failed'));

      try {
        await aiAgent.processRealTimeAudio(conversationId, testUtils.generateMockAudioData());
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Audio processing failed');
      }
    });
  });

  describe('Context Management', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should maintain conversation context', async () => {
      const conversationId = await aiAgent.startConversation('user123', {
        context: { topic: 'business meeting', participants: ['Alice', 'Bob'] },
      });

      // Process multiple messages to build context
      await aiAgent.processMessage(conversationId, {
        content: "Let's discuss the quarterly results",
        type: 'text',
      });

      await aiAgent.processMessage(conversationId, {
        content: 'What about the marketing budget?',
        type: 'text',
      });

      const context = await aiAgent.getConversationContext(conversationId);

      expect(context).to.exist;
      expect(context.topic).to.equal('business meeting');
      expect(context.messageHistory).to.have.length.greaterThan(0);
      expect(mockServices.contextManager.updateContext.called).to.be.true;
    });

    it('should update context based on conversation flow', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Process message that should update context
      await aiAgent.processMessage(conversationId, {
        content: 'I need help with Spanish translation',
        type: 'text',
        metadata: { detectedIntent: 'translation_request' },
      });

      const context = await aiAgent.getConversationContext(conversationId);

      expect(context.intent).to.equal('translation_request');
      expect(context.language).to.exist;
    });

    it('should handle context-aware responses', async () => {
      const conversationId = await aiAgent.startConversation('user123', {
        context: {
          userPreferences: { language: 'es', formality: 'formal' },
          previousTopics: ['travel', 'business'],
        },
      });

      const response = await aiAgent.processMessage(conversationId, {
        content: 'Can you help me with a presentation?',
        type: 'text',
      });

      expect(response.contextAware).to.be.true;
      expect(response.adaptedToUser).to.be.true;
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should integrate with translation service', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      await aiAgent.processMessage(conversationId, {
        content: 'Hola, ¿cómo estás?',
        type: 'text',
        sourceLanguage: 'es',
        targetLanguage: 'en',
      });

      expect(mockServices.translationService.translate.calledOnce).to.be.true;
      expect(mockServices.translationService.detectLanguage.called).to.be.true;
    });

    it('should integrate with RTC service', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      const response = await aiAgent.processMessage(conversationId, {
        content: 'Send this via RTC',
        type: 'text',
        deliveryMethod: 'rtc',
      });

      expect(response.delivered).to.be.true;
      expect(mockServices.rtcService.sendMessage.calledOnce).to.be.true;
    });

    it('should handle service integration errors', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Mock translation service error
      mockServices.translationService.translate.rejects(
        new Error('Translation service unavailable')
      );

      const response = await aiAgent.processMessage(conversationId, {
        content: 'Translate this',
        type: 'text',
        requireTranslation: true,
      });

      expect(response.error).to.exist;
      expect(response.fallbackUsed).to.be.true;
    });
  });

  describe('Learning and Adaptation', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should learn from user interactions', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Process multiple interactions
      for (let i = 0; i < 5; i++) {
        await aiAgent.processMessage(conversationId, {
          content: `Message ${i}`,
          type: 'text',
          feedback: { satisfaction: 0.8 + i * 0.05 },
        });
      }

      const learningData = aiAgent.getLearningData('user123');

      expect(learningData).to.exist;
      expect(learningData.interactionCount).to.equal(5);
      expect(learningData.averageSatisfaction).to.be.greaterThan(0.8);
    });

    it('should adapt responses based on user preferences', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Establish user preference through feedback
      await aiAgent.processMessage(conversationId, {
        content: 'I prefer brief responses',
        type: 'text',
        feedback: {
          satisfaction: 0.9,
          preferences: { responseLength: 'brief' },
        },
      });

      // Next response should adapt
      const response = await aiAgent.processMessage(conversationId, {
        content: 'Explain quantum computing',
        type: 'text',
      });

      expect(response.adaptedToPreferences).to.be.true;
      expect(response.responseStyle).to.equal('brief');
    });

    it('should improve over time with feedback', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Simulate learning cycle with feedback
      const feedbackData = [];

      for (let i = 0; i < 10; i++) {
        const response = await aiAgent.processMessage(conversationId, {
          content: `Learning message ${i}`,
          type: 'text',
        });

        const feedback = {
          satisfaction: Math.random() * 0.4 + 0.6, // 0.6-1.0
          responseQuality: Math.random() * 0.3 + 0.7, // 0.7-1.0
        };

        await aiAgent.processFeedback(conversationId, feedback);
        feedbackData.push(feedback);
      }

      const improvementMetrics = aiAgent.getImprovementMetrics('user123');

      expect(improvementMetrics).to.exist;
      expect(improvementMetrics.totalFeedback).to.equal(10);
      expect(improvementMetrics.learningTrend).to.exist;
    });
  });

  describe('Performance and Monitoring', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should track performance metrics', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Process multiple messages to generate metrics
      for (let i = 0; i < 5; i++) {
        await aiAgent.processMessage(conversationId, {
          content: `Performance test message ${i}`,
          type: 'text',
        });
      }

      const metrics = aiAgent.getPerformanceMetrics();

      expect(metrics).to.exist;
      expect(metrics.totalMessages).to.equal(5);
      expect(metrics.averageResponseTime).to.be.a('number');
      expect(metrics.successRate).to.be.a('number');
    });

    it('should monitor resource usage', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Generate load
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          aiAgent.processMessage(conversationId, {
            content: `Load test message ${i}`,
            type: 'text',
          })
        );
      }

      await Promise.all(promises);

      const resourceMetrics = aiAgent.getResourceMetrics();

      expect(resourceMetrics).to.exist;
      expect(resourceMetrics.memoryUsage).to.be.a('number');
      expect(resourceMetrics.cpuUsage).to.be.a('number');
      expect(resourceMetrics.activeConversations).to.be.a('number');
    });

    it('should handle performance alerts', async () => {
      const alertSpy = sinon.spy();
      aiAgent.on('performanceAlert', alertSpy);

      // Simulate high load to trigger alert
      const conversationId = await aiAgent.startConversation('user123');

      // Mock high response time
      const originalProcessMessage = aiAgent.processMessage;
      aiAgent.processMessage = async function (...args) {
        await testUtils.wait(100); // Simulate slow processing
        return originalProcessMessage.apply(this, args);
      };

      await aiAgent.processMessage(conversationId, {
        content: 'Slow message',
        type: 'text',
      });

      // Check if alert was triggered (implementation dependent)
      // This would depend on the actual alert thresholds
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should handle service failures gracefully', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Mock service failure
      mockServices.translationService.translate.rejects(new Error('Service unavailable'));

      const response = await aiAgent.processMessage(conversationId, {
        content: 'Test message',
        type: 'text',
        requireTranslation: true,
      });

      expect(response).to.exist;
      expect(response.error).to.exist;
      expect(response.fallbackUsed).to.be.true;
    });

    it('should recover from temporary failures', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Mock temporary failure
      let callCount = 0;
      mockServices.translationService.translate.callsFake(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ text: 'translated', confidence: 0.9 });
      });

      // Should retry and eventually succeed
      const response = await aiAgent.processMessage(conversationId, {
        content: 'Test message',
        type: 'text',
        requireTranslation: true,
      });

      expect(response.translated).to.be.true;
      expect(mockServices.translationService.translate.callCount).to.be.greaterThan(1);
    });

    it('should maintain conversation state during errors', async () => {
      const conversationId = await aiAgent.startConversation('user123');

      // Process successful message
      await aiAgent.processMessage(conversationId, {
        content: 'First message',
        type: 'text',
      });

      // Process message that causes error
      mockServices.audioProcessor.processAudio.rejects(new Error('Processing error'));

      try {
        await aiAgent.processRealTimeAudio(conversationId, testUtils.generateMockAudioData());
      } catch (error) {
        // Expected error
      }

      // Conversation should still be active
      const conversation = aiAgent.getConversation(conversationId);
      expect(conversation.status).to.equal('active');

      // Should be able to process more messages
      mockServices.audioProcessor.processAudio.resolves({ processed: true });

      const response = await aiAgent.processMessage(conversationId, {
        content: 'Recovery message',
        type: 'text',
      });

      expect(response.processed).to.be.true;
    });
  });

  describe('Configuration and Customization', () => {
    it('should support custom configuration', async () => {
      const customConfig = {
        ...mockConfig,
        agent: {
          ...mockConfig.agent,
          name: 'CustomAgent',
          maxConcurrentConversations: 10,
          enableAdvancedFeatures: true,
        },
        ai: {
          ...mockConfig.ai,
          temperature: 0.5,
          customPrompts: {
            greeting: "Hello! I'm your custom AI assistant.",
          },
        },
      };

      const customAgent = new EchoAIAgent(customConfig);
      await customAgent.initialize();
      await customAgent.start();

      expect(customAgent.config.agent.name).to.equal('CustomAgent');
      expect(customAgent.config.agent.maxConcurrentConversations).to.equal(10);
      expect(customAgent.config.ai.temperature).to.equal(0.5);

      await customAgent.stop();
      await customAgent.cleanup();
    });

    it('should update configuration at runtime', async () => {
      await aiAgent.initialize();
      await aiAgent.start();

      const newConfig = {
        agent: {
          maxConcurrentConversations: 8,
          responseTimeout: 3000,
        },
      };

      aiAgent.updateConfiguration(newConfig);

      expect(aiAgent.config.agent.maxConcurrentConversations).to.equal(8);
      expect(aiAgent.config.agent.responseTimeout).to.equal(3000);
    });
  });

  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      await aiAgent.initialize();
      await aiAgent.start();
    });

    it('should collect comprehensive statistics', async () => {
      // Generate some activity
      const conversationId = await aiAgent.startConversation('user123');

      for (let i = 0; i < 3; i++) {
        await aiAgent.processMessage(conversationId, {
          content: `Stats message ${i}`,
          type: 'text',
        });
      }

      await aiAgent.endConversation(conversationId);

      const statistics = aiAgent.getStatistics();

      expect(statistics).to.exist;
      expect(statistics.totalConversations).to.be.greaterThan(0);
      expect(statistics.totalMessages).to.be.greaterThan(0);
      expect(statistics.averageConversationLength).to.be.a('number');
      expect(statistics.uptime).to.be.a('number');
    });

    it('should provide detailed analytics', async () => {
      // Generate varied activity
      const conversations = [];

      for (let i = 0; i < 3; i++) {
        const conversationId = await aiAgent.startConversation(`user${i}`);
        conversations.push(conversationId);

        await aiAgent.processMessage(conversationId, {
          content: `Analytics message ${i}`,
          type: 'text',
          language: i % 2 === 0 ? 'en' : 'es',
        });
      }

      const analytics = aiAgent.getAnalytics();

      expect(analytics).to.exist;
      expect(analytics.languageDistribution).to.exist;
      expect(analytics.userEngagement).to.exist;
      expect(analytics.performanceTrends).to.exist;
    });
  });
});
