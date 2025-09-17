import { expect } from 'chai';
import sinon from 'sinon';
import { ConversationManager } from '../conversation-manager.js';
import { TestUtils } from '../../utils/test-utils.js';

/**
 * Integration tests for ConversationManager
 * Tests conversation flow control, context management, session handling,
 * memory management, and language processing capabilities
 */
describe('ConversationManager Integration Tests', () => {
  let conversationManager;
  let mockConfig;
  let mockServices;
  let testUtils;

  beforeEach(async () => {
    // Setup test utilities
    testUtils = new TestUtils();

    // Mock external services
    mockServices = {
      languageProcessor: {
        processMessage: sinon.stub().resolves({
          processed: true,
          intent: 'translation_request',
          entities: [{ type: 'language', value: 'spanish' }],
          sentiment: { score: 0.8, label: 'positive' },
          confidence: 0.92,
        }),
        detectLanguage: sinon.stub().resolves({ language: 'en', confidence: 0.95 }),
        extractEntities: sinon.stub().resolves([
          { type: 'person', value: 'John', confidence: 0.9 },
          { type: 'location', value: 'Paris', confidence: 0.85 },
        ]),
      },

      contextProcessor: {
        updateContext: sinon.stub().resolves({
          updated: true,
          contextId: 'ctx123',
          relevantHistory: ['msg1', 'msg2'],
        }),
        getContext: sinon.stub().returns({
          conversationId: 'conv123',
          userId: 'user123',
          history: [],
          metadata: { domain: 'translation' },
        }),
        analyzeContext: sinon.stub().resolves({
          analyzed: true,
          topics: ['translation', 'language_learning'],
          mood: 'helpful',
          complexity: 'medium',
        }),
      },

      qualityController: {
        assessQuality: sinon.stub().resolves({
          score: 0.88,
          factors: {
            relevance: 0.9,
            coherence: 0.85,
            completeness: 0.9,
          },
          suggestions: ['Add more context', 'Clarify intent'],
        }),
        validateResponse: sinon.stub().resolves({
          valid: true,
          confidence: 0.92,
          issues: [],
        }),
      },

      memoryManager: {
        store: sinon.stub().resolves({ stored: true, memoryId: 'mem123' }),
        retrieve: sinon.stub().resolves({
          memories: [
            { id: 'mem1', content: 'Previous translation request', relevance: 0.8 },
            { id: 'mem2', content: 'User prefers formal tone', relevance: 0.7 },
          ],
        }),
        update: sinon.stub().resolves({ updated: true }),
        forget: sinon.stub().resolves({ forgotten: true }),
      },

      sessionManager: {
        createSession: sinon.stub().resolves({
          sessionId: 'session123',
          created: true,
          expiresAt: Date.now() + 3600000,
        }),
        getSession: sinon.stub().returns({
          sessionId: 'session123',
          active: true,
          startTime: Date.now() - 60000,
          messageCount: 5,
        }),
        updateSession: sinon.stub().resolves({ updated: true }),
        endSession: sinon.stub().resolves({ ended: true }),
      },
    };

    // Test configuration
    mockConfig = {
      conversation: {
        name: 'TestConversationManager',
        version: '1.0.0-test',
        maxConcurrentConversations: 100,
        defaultTimeout: 300000,
        enableContextTracking: true,
        enableMemoryManagement: true,
        enableQualityControl: true,
        enableLanguageProcessing: true,
      },

      flow: {
        maxTurns: 50,
        turnTimeout: 30000,
        enableFlowControl: true,
        enableInterruption: true,
        enableRedirection: true,
        flowStrategies: ['linear', 'branching', 'adaptive'],
      },

      context: {
        maxHistoryLength: 20,
        contextWindow: 4096,
        enableContextCompression: true,
        enableSemanticSearch: true,
        relevanceThreshold: 0.7,
        updateStrategy: 'incremental',
      },

      memory: {
        enabled: true,
        maxMemories: 1000,
        retentionPeriod: 2592000000, // 30 days
        compressionThreshold: 0.8,
        forgettingCurve: 'exponential',
      },

      language: {
        enableNLP: true,
        enableSentimentAnalysis: true,
        enableEntityExtraction: true,
        enableIntentRecognition: true,
        supportedLanguages: ['en', 'es', 'fr', 'de'],
      },

      quality: {
        enabled: true,
        minQualityScore: 0.7,
        enableRealTimeAssessment: true,
        enableResponseValidation: true,
        qualityFactors: ['relevance', 'coherence', 'completeness', 'accuracy'],
      },

      caching: {
        enabled: true,
        ttl: 1800000, // 30 minutes
        maxSize: 500,
        strategy: 'lru',
      },

      services: mockServices,
    };

    // Create conversation manager instance
    conversationManager = new ConversationManager(mockConfig);
  });

  afterEach(async () => {
    if (conversationManager && conversationManager.isRunning) {
      await conversationManager.stop();
    }
    await conversationManager?.cleanup();
    sinon.restore();
  });

  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully with valid configuration', async () => {
      await conversationManager.initialize();

      expect(conversationManager.isInitialized).to.be.true;
      expect(conversationManager.getStatus().initialized).to.be.true;
    });

    it('should start and stop successfully', async () => {
      await conversationManager.initialize();
      await conversationManager.start();

      expect(conversationManager.isRunning).to.be.true;
      expect(conversationManager.getStatus().running).to.be.true;

      await conversationManager.stop();

      expect(conversationManager.isRunning).to.be.false;
      expect(conversationManager.getStatus().running).to.be.false;
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.conversation.name;

      const invalidManager = new ConversationManager(invalidConfig);

      try {
        await invalidManager.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Conversation manager name is required');
      }
    });

    it('should emit lifecycle events', async () => {
      const initSpy = sinon.spy();
      const startSpy = sinon.spy();
      const stopSpy = sinon.spy();

      conversationManager.on('initialized', initSpy);
      conversationManager.on('started', startSpy);
      conversationManager.on('stopped', stopSpy);

      await conversationManager.initialize();
      await conversationManager.start();
      await conversationManager.stop();

      expect(initSpy.calledOnce).to.be.true;
      expect(startSpy.calledOnce).to.be.true;
      expect(stopSpy.calledOnce).to.be.true;
    });
  });

  describe('Conversation Flow Control', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should start new conversations', async () => {
      const conversationRequest = {
        userId: 'user123',
        initialMessage: 'Hello, I need help with translation',
        context: {
          domain: 'translation',
          language: 'en',
          priority: 'normal',
        },
        preferences: {
          responseStyle: 'helpful',
          verbosity: 'medium',
        },
      };

      const conversation = await conversationManager.startConversation(conversationRequest);

      expect(conversation).to.exist;
      expect(conversation.conversationId).to.exist;
      expect(conversation.active).to.be.true;
      expect(conversation.userId).to.equal('user123');
      expect(conversation.turnCount).to.equal(1);
    });

    it('should process conversation turns', async () => {
      // Start conversation
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Hello',
      });

      // Process next turn
      const turnRequest = {
        conversationId: conversation.conversationId,
        message: 'Can you translate "hello" to Spanish?',
        metadata: {
          timestamp: Date.now(),
          messageType: 'text',
        },
      };

      const turnResult = await conversationManager.processTurn(turnRequest);

      expect(turnResult).to.exist;
      expect(turnResult.processed).to.be.true;
      expect(turnResult.conversationId).to.equal(conversation.conversationId);
      expect(turnResult.turnNumber).to.equal(2);
      expect(turnResult.response).to.exist;
    });

    it('should handle conversation branching', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'I need help with multiple things',
      });

      // Create a branch point
      const branchRequest = {
        conversationId: conversation.conversationId,
        branchType: 'topic_split',
        branches: [
          { topic: 'translation', priority: 'high' },
          { topic: 'language_learning', priority: 'medium' },
        ],
      };

      const branchResult = await conversationManager.createBranch(branchRequest);

      expect(branchResult).to.exist;
      expect(branchResult.branched).to.be.true;
      expect(branchResult.branches).to.have.length(2);
      expect(branchResult.activeBranch).to.exist;
    });

    it('should manage conversation interruptions', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Start a long conversation',
      });

      // Simulate interruption
      const interruptionRequest = {
        conversationId: conversation.conversationId,
        interruptionType: 'urgent_request',
        newMessage: 'Actually, I need immediate help with something else',
        preserveContext: true,
      };

      const interruptionResult = await conversationManager.handleInterruption(interruptionRequest);

      expect(interruptionResult).to.exist;
      expect(interruptionResult.interrupted).to.be.true;
      expect(interruptionResult.contextPreserved).to.be.true;
      expect(interruptionResult.newFlow).to.exist;
    });

    it('should redirect conversations when needed', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'I think I need technical support',
      });

      // Simulate redirection need
      const redirectionRequest = {
        conversationId: conversation.conversationId,
        redirectionReason: 'out_of_scope',
        targetService: 'technical_support',
        transferContext: true,
      };

      const redirectionResult = await conversationManager.redirectConversation(redirectionRequest);

      expect(redirectionResult).to.exist;
      expect(redirectionResult.redirected).to.be.true;
      expect(redirectionResult.targetService).to.equal('technical_support');
      expect(redirectionResult.contextTransferred).to.be.true;
    });

    it('should end conversations properly', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Quick question',
      });

      const endRequest = {
        conversationId: conversation.conversationId,
        reason: 'user_request',
        saveContext: true,
        generateSummary: true,
      };

      const endResult = await conversationManager.endConversation(endRequest);

      expect(endResult).to.exist;
      expect(endResult.ended).to.be.true;
      expect(endResult.contextSaved).to.be.true;
      expect(endResult.summary).to.exist;
    });
  });

  describe('Context Management', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should maintain conversation context', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'I want to learn Spanish',
        context: { domain: 'language_learning' },
      });

      // Add more context through turns
      await conversationManager.processTurn({
        conversationId: conversation.conversationId,
        message: 'I am a beginner',
      });

      await conversationManager.processTurn({
        conversationId: conversation.conversationId,
        message: 'I prefer formal language',
      });

      const context = conversationManager.getConversationContext(conversation.conversationId);

      expect(context).to.exist;
      expect(context.conversationId).to.equal(conversation.conversationId);
      expect(context.history).to.have.length.greaterThan(0);
      expect(context.metadata.domain).to.equal('language_learning');
    });

    it('should update context incrementally', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Hello',
      });

      const contextUpdate = {
        conversationId: conversation.conversationId,
        updates: {
          userPreferences: { tone: 'formal', speed: 'slow' },
          topics: ['translation', 'grammar'],
          expertise: 'beginner',
        },
        strategy: 'merge',
      };

      const updateResult = await conversationManager.updateContext(contextUpdate);

      expect(updateResult).to.exist;
      expect(updateResult.updated).to.be.true;
      expect(updateResult.contextId).to.equal('ctx123');

      const updatedContext = conversationManager.getConversationContext(
        conversation.conversationId
      );
      expect(updatedContext.userPreferences).to.exist;
      expect(updatedContext.topics).to.include('translation');
    });

    it('should compress context when needed', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Start long conversation',
      });

      // Add many turns to trigger compression
      for (let i = 0; i < 25; i++) {
        await conversationManager.processTurn({
          conversationId: conversation.conversationId,
          message: `Message ${i + 1}`,
        });
      }

      const compressionResult = await conversationManager.compressContext(
        conversation.conversationId
      );

      expect(compressionResult).to.exist;
      expect(compressionResult.compressed).to.be.true;
      expect(compressionResult.originalSize).to.be.greaterThan(compressionResult.compressedSize);
      expect(compressionResult.retainedInformation).to.be.greaterThan(0.8);
    });

    it('should perform semantic search on context', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'I need help with Spanish translation',
      });

      // Add relevant context
      await conversationManager.processTurn({
        conversationId: conversation.conversationId,
        message: 'Specifically business terminology',
      });

      const searchRequest = {
        conversationId: conversation.conversationId,
        query: 'business Spanish translation',
        maxResults: 5,
        minRelevance: 0.7,
      };

      const searchResult = await conversationManager.searchContext(searchRequest);

      expect(searchResult).to.exist;
      expect(searchResult.results).to.be.an('array');
      expect(searchResult.results.length).to.be.greaterThan(0);
      expect(searchResult.results[0].relevance).to.be.greaterThan(0.7);
    });
  });

  describe('Session Handling', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should create and manage sessions', async () => {
      const sessionRequest = {
        userId: 'user123',
        sessionType: 'translation_assistance',
        preferences: {
          language: 'en',
          domain: 'business',
        },
        timeout: 3600000,
      };

      const session = await conversationManager.createSession(sessionRequest);

      expect(session).to.exist;
      expect(session.sessionId).to.equal('session123');
      expect(session.created).to.be.true;
      expect(session.expiresAt).to.be.a('number');
    });

    it('should track session activity', async () => {
      const session = await conversationManager.createSession({
        userId: 'user123',
        sessionType: 'general',
      });

      // Start conversation in session
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        sessionId: session.sessionId,
        initialMessage: 'Hello',
      });

      // Process some turns
      for (let i = 0; i < 3; i++) {
        await conversationManager.processTurn({
          conversationId: conversation.conversationId,
          message: `Turn ${i + 1}`,
        });
      }

      const sessionInfo = conversationManager.getSessionInfo(session.sessionId);

      expect(sessionInfo).to.exist;
      expect(sessionInfo.active).to.be.true;
      expect(sessionInfo.messageCount).to.equal(5); // Mock returns 5
      expect(sessionInfo.conversationCount).to.be.greaterThan(0);
    });

    it('should handle session expiration', async () => {
      // Create session with short timeout
      const shortSession = await conversationManager.createSession({
        userId: 'user123',
        sessionType: 'test',
        timeout: 100, // 100ms
      });

      // Wait for expiration
      await testUtils.wait(150);

      const expirationResult = await conversationManager.checkSessionExpiration(
        shortSession.sessionId
      );

      expect(expirationResult).to.exist;
      expect(expirationResult.expired).to.be.true;
      expect(expirationResult.action).to.equal('cleanup');
    });

    it('should end sessions properly', async () => {
      const session = await conversationManager.createSession({
        userId: 'user123',
        sessionType: 'test',
      });

      const endResult = await conversationManager.endSession({
        sessionId: session.sessionId,
        reason: 'user_request',
        saveData: true,
      });

      expect(endResult).to.exist;
      expect(endResult.ended).to.be.true;
      expect(endResult.dataSaved).to.be.true;
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should store conversation memories', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'I prefer formal Spanish translations',
      });

      const memoryRequest = {
        conversationId: conversation.conversationId,
        memoryType: 'preference',
        content: 'User prefers formal tone in Spanish translations',
        importance: 0.9,
        tags: ['preference', 'spanish', 'formal'],
      };

      const memoryResult = await conversationManager.storeMemory(memoryRequest);

      expect(memoryResult).to.exist;
      expect(memoryResult.stored).to.be.true;
      expect(memoryResult.memoryId).to.equal('mem123');
    });

    it('should retrieve relevant memories', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Help me with Spanish again',
      });

      const retrievalRequest = {
        conversationId: conversation.conversationId,
        query: 'Spanish translation preferences',
        maxMemories: 5,
        minRelevance: 0.6,
      };

      const memories = await conversationManager.retrieveMemories(retrievalRequest);

      expect(memories).to.exist;
      expect(memories.memories).to.be.an('array');
      expect(memories.memories.length).to.be.greaterThan(0);
      expect(memories.memories[0].relevance).to.be.greaterThan(0.6);
    });

    it('should update existing memories', async () => {
      const updateRequest = {
        memoryId: 'mem123',
        updates: {
          content: 'Updated: User strongly prefers formal tone',
          importance: 0.95,
          lastAccessed: Date.now(),
        },
      };

      const updateResult = await conversationManager.updateMemory(updateRequest);

      expect(updateResult).to.exist;
      expect(updateResult.updated).to.be.true;
    });

    it('should implement forgetting curve', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Test forgetting',
      });

      // Store memory with timestamp
      await conversationManager.storeMemory({
        conversationId: conversation.conversationId,
        content: 'Old preference',
        timestamp: Date.now() - 2592000000, // 30 days ago
        importance: 0.5,
      });

      const forgettingResult = await conversationManager.applyForgettingCurve(
        conversation.conversationId
      );

      expect(forgettingResult).to.exist;
      expect(forgettingResult.processed).to.be.true;
      expect(forgettingResult.memoriesAffected).to.be.a('number');
    });

    it('should forget irrelevant memories', async () => {
      const forgetRequest = {
        memoryId: 'mem123',
        reason: 'user_request',
        permanent: false,
      };

      const forgetResult = await conversationManager.forgetMemory(forgetRequest);

      expect(forgetResult).to.exist;
      expect(forgetResult.forgotten).to.be.true;
    });
  });

  describe('Language Processing', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should process natural language messages', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'I need to translate this document to Spanish for my business meeting',
      });

      const processingResult = await conversationManager.processLanguage({
        conversationId: conversation.conversationId,
        message: 'I need to translate this document to Spanish for my business meeting',
        analysisDepth: 'full',
      });

      expect(processingResult).to.exist;
      expect(processingResult.processed).to.be.true;
      expect(processingResult.intent).to.equal('translation_request');
      expect(processingResult.entities).to.be.an('array');
      expect(processingResult.sentiment.score).to.equal(0.8);
      expect(processingResult.confidence).to.equal(0.92);
    });

    it('should detect message language', async () => {
      const detectionRequest = {
        message: 'Bonjour, je voudrais traduire ce texte',
        context: { userId: 'user123' },
      };

      const detectionResult = await conversationManager.detectMessageLanguage(detectionRequest);

      expect(detectionResult).to.exist;
      expect(detectionResult.language).to.equal('en'); // Mock returns 'en'
      expect(detectionResult.confidence).to.equal(0.95);
    });

    it('should extract entities from messages', async () => {
      const extractionRequest = {
        message: 'Please translate this for John when he visits Paris next week',
        entityTypes: ['person', 'location', 'time'],
      };

      const entities = await conversationManager.extractEntities(extractionRequest);

      expect(entities).to.be.an('array');
      expect(entities.length).to.be.greaterThan(0);
      expect(entities[0].type).to.equal('person');
      expect(entities[0].value).to.equal('John');
      expect(entities[0].confidence).to.equal(0.9);
    });

    it('should analyze sentiment and emotion', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'I am frustrated with these translation errors!',
      });

      const sentimentResult = await conversationManager.analyzeSentiment({
        conversationId: conversation.conversationId,
        message: 'I am frustrated with these translation errors!',
      });

      expect(sentimentResult).to.exist;
      expect(sentimentResult.sentiment).to.exist;
      expect(sentimentResult.sentiment.score).to.be.a('number');
      expect(sentimentResult.sentiment.label).to.be.a('string');
      expect(sentimentResult.emotions).to.be.an('array');
    });
  });

  describe('Quality Control', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should assess conversation quality', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Help me translate',
      });

      // Process a few turns
      await conversationManager.processTurn({
        conversationId: conversation.conversationId,
        message: 'I need business Spanish',
      });

      const qualityAssessment = await conversationManager.assessQuality({
        conversationId: conversation.conversationId,
        assessmentType: 'comprehensive',
      });

      expect(qualityAssessment).to.exist;
      expect(qualityAssessment.score).to.equal(0.88);
      expect(qualityAssessment.factors).to.exist;
      expect(qualityAssessment.factors.relevance).to.equal(0.9);
      expect(qualityAssessment.suggestions).to.be.an('array');
    });

    it('should validate responses before sending', async () => {
      const validationRequest = {
        response: 'Here is your Spanish translation: "Hola, ¿cómo está usted?"',
        context: {
          originalMessage: 'Translate "Hello, how are you?" to formal Spanish',
          conversationId: 'conv123',
        },
        validationRules: ['accuracy', 'appropriateness', 'completeness'],
      };

      const validationResult = await conversationManager.validateResponse(validationRequest);

      expect(validationResult).to.exist;
      expect(validationResult.valid).to.be.true;
      expect(validationResult.confidence).to.equal(0.92);
      expect(validationResult.issues).to.be.an('array');
    });

    it('should provide quality improvement suggestions', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Help',
      });

      const suggestions = await conversationManager.getQualityImprovements({
        conversationId: conversation.conversationId,
        focusAreas: ['clarity', 'completeness', 'engagement'],
      });

      expect(suggestions).to.exist;
      expect(suggestions.improvements).to.be.an('array');
      expect(suggestions.improvements.length).to.be.greaterThan(0);
      expect(suggestions.priority).to.exist;
    });

    it('should monitor quality trends', async () => {
      // Generate multiple conversations for trend analysis
      const conversations = [];
      for (let i = 0; i < 3; i++) {
        const conv = await conversationManager.startConversation({
          userId: `user${i}`,
          initialMessage: `Test conversation ${i}`,
        });
        conversations.push(conv);
      }

      const qualityTrends = conversationManager.getQualityTrends({
        timeRange: { start: Date.now() - 3600000, end: Date.now() },
        metrics: ['averageScore', 'improvementRate', 'issueFrequency'],
      });

      expect(qualityTrends).to.exist;
      expect(qualityTrends.trends).to.be.an('object');
      expect(qualityTrends.summary).to.exist;
    });
  });

  describe('Caching and Optimization', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should cache frequently accessed data', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Cache test',
      });

      // First access should hit the service
      const context1 = conversationManager.getConversationContext(conversation.conversationId);
      expect(context1.fromCache).to.be.false;

      // Second access should hit the cache
      const context2 = conversationManager.getConversationContext(conversation.conversationId);
      expect(context2.fromCache).to.be.true;
    });

    it('should optimize memory usage', async () => {
      // Create multiple conversations to test memory optimization
      const conversations = [];
      for (let i = 0; i < 10; i++) {
        const conv = await conversationManager.startConversation({
          userId: `user${i}`,
          initialMessage: `Memory test ${i}`,
        });
        conversations.push(conv);
      }

      const optimizationResult = await conversationManager.optimizeMemory();

      expect(optimizationResult).to.exist;
      expect(optimizationResult.optimized).to.be.true;
      expect(optimizationResult.memoryFreed).to.be.a('number');
      expect(optimizationResult.activeConversations).to.be.a('number');
    });

    it('should preload relevant context', async () => {
      const preloadRequest = {
        userId: 'user123',
        expectedTopics: ['translation', 'spanish'],
        contextDepth: 'medium',
      };

      const preloadResult = await conversationManager.preloadContext(preloadRequest);

      expect(preloadResult).to.exist;
      expect(preloadResult.preloaded).to.be.true;
      expect(preloadResult.contextItems).to.be.a('number');
      expect(preloadResult.cacheHitRate).to.be.a('number');
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should handle service failures gracefully', async () => {
      // Mock service failure
      mockServices.languageProcessor.processMessage.rejects(new Error('NLP service down'));

      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Test error handling',
      });

      const turnResult = await conversationManager.processTurn({
        conversationId: conversation.conversationId,
        message: 'This should handle the error',
      });

      expect(turnResult).to.exist;
      expect(turnResult.processed).to.be.true;
      expect(turnResult.fallbackUsed).to.be.true;
      expect(turnResult.error).to.exist;
    });

    it('should recover from context corruption', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Test context recovery',
      });

      // Simulate context corruption
      const recoveryResult = await conversationManager.recoverContext({
        conversationId: conversation.conversationId,
        corruptionType: 'partial_loss',
        recoveryStrategy: 'rebuild_from_history',
      });

      expect(recoveryResult).to.exist;
      expect(recoveryResult.recovered).to.be.true;
      expect(recoveryResult.recoveryMethod).to.exist;
      expect(recoveryResult.dataIntegrity).to.be.greaterThan(0.8);
    });

    it('should maintain conversation continuity during errors', async () => {
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Start conversation',
      });

      // Simulate various error conditions
      mockServices.contextProcessor.updateContext.rejects(new Error('Context service error'));

      // Conversation should continue despite errors
      const turnResult = await conversationManager.processTurn({
        conversationId: conversation.conversationId,
        message: 'Continue despite errors',
      });

      expect(turnResult.processed).to.be.true;
      expect(conversationManager.isConversationActive(conversation.conversationId)).to.be.true;
    });
  });

  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      await conversationManager.initialize();
      await conversationManager.start();
    });

    it('should collect comprehensive conversation statistics', async () => {
      // Generate varied conversation activity
      const conversations = [];
      for (let i = 0; i < 3; i++) {
        const conv = await conversationManager.startConversation({
          userId: `user${i}`,
          initialMessage: `Statistics test ${i}`,
        });
        conversations.push(conv);

        // Add some turns
        for (let j = 0; j < 2; j++) {
          await conversationManager.processTurn({
            conversationId: conv.conversationId,
            message: `Turn ${j + 1}`,
          });
        }
      }

      const statistics = conversationManager.getStatistics();

      expect(statistics).to.exist;
      expect(statistics.totalConversations).to.be.greaterThan(0);
      expect(statistics.totalTurns).to.be.greaterThan(0);
      expect(statistics.averageTurnsPerConversation).to.be.a('number');
      expect(statistics.averageConversationDuration).to.be.a('number');
      expect(statistics.qualityMetrics).to.exist;
    });

    it('should generate detailed analytics reports', async () => {
      // Generate activity for reporting
      const conversation = await conversationManager.startConversation({
        userId: 'user123',
        initialMessage: 'Analytics test',
      });

      await conversationManager.processTurn({
        conversationId: conversation.conversationId,
        message: 'Generate analytics data',
      });

      const report = conversationManager.generateAnalyticsReport({
        timeRange: { start: Date.now() - 3600000, end: Date.now() },
        includeDetails: true,
        metrics: ['engagement', 'quality', 'efficiency', 'satisfaction'],
      });

      expect(report).to.exist;
      expect(report.summary).to.exist;
      expect(report.conversationMetrics).to.exist;
      expect(report.userBehavior).to.exist;
      expect(report.qualityAnalysis).to.exist;
      expect(report.recommendations).to.exist;
    });
  });
});
