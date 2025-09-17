import { expect } from 'chai';
import sinon from 'sinon';
import { LearningAdaptation } from '../learning-adaptation.js';
import { TestUtils } from '../../utils/test-utils.js';

/**
 * Integration tests for LearningAdaptation
 * Tests continuous learning, personalization, model improvement,
 * feedback processing, and knowledge management capabilities
 */
describe('LearningAdaptation Integration Tests', () => {
  let learningAdaptation;
  let mockConfig;
  let mockServices;
  let testUtils;

  beforeEach(async () => {
    // Setup test utilities
    testUtils = new TestUtils();

    // Mock external services
    mockServices = {
      modelManager: {
        loadModel: sinon.stub().resolves({
          loaded: true,
          modelId: 'model123',
          version: '1.0.0',
          capabilities: ['translation', 'sentiment', 'intent'],
        }),
        updateModel: sinon.stub().resolves({
          updated: true,
          improvements: { accuracy: 0.05, speed: 0.02 },
          version: '1.0.1',
        }),
        evaluateModel: sinon.stub().resolves({
          accuracy: 0.92,
          precision: 0.89,
          recall: 0.91,
          f1Score: 0.9,
        }),
        saveModel: sinon.stub().resolves({ saved: true, checksum: 'abc123' }),
      },

      personalizationEngine: {
        createProfile: sinon.stub().resolves({
          profileId: 'profile123',
          created: true,
          preferences: { language: 'en', domain: 'business' },
        }),
        updateProfile: sinon.stub().resolves({
          updated: true,
          changes: ['preferences', 'behavior_patterns'],
          confidence: 0.85,
        }),
        getRecommendations: sinon.stub().resolves({
          recommendations: [
            { type: 'response_style', value: 'formal', confidence: 0.9 },
            { type: 'content_depth', value: 'detailed', confidence: 0.8 },
          ],
        }),
        analyzePreferences: sinon.stub().resolves({
          analyzed: true,
          patterns: ['prefers_examples', 'formal_tone', 'step_by_step'],
          confidence: 0.88,
        }),
      },

      feedbackProcessor: {
        processFeedback: sinon.stub().resolves({
          processed: true,
          feedbackId: 'feedback123',
          sentiment: 'positive',
          actionItems: ['improve_accuracy', 'add_examples'],
        }),
        analyzeFeedback: sinon.stub().resolves({
          analyzed: true,
          insights: {
            satisfaction: 0.85,
            areas_for_improvement: ['response_time', 'accuracy'],
            positive_aspects: ['helpfulness', 'clarity'],
          },
        }),
        extractLearnings: sinon.stub().resolves({
          learnings: [
            { type: 'user_preference', value: 'detailed_explanations', weight: 0.8 },
            { type: 'common_error', value: 'context_misunderstanding', weight: 0.7 },
          ],
        }),
      },

      knowledgeManager: {
        storeKnowledge: sinon.stub().resolves({
          stored: true,
          knowledgeId: 'knowledge123',
          category: 'user_patterns',
        }),
        retrieveKnowledge: sinon.stub().resolves({
          knowledge: [
            { id: 'k1', content: 'Users prefer formal tone', relevance: 0.9 },
            { id: 'k2', content: 'Common translation errors', relevance: 0.8 },
          ],
        }),
        updateKnowledge: sinon.stub().resolves({ updated: true }),
        searchKnowledge: sinon.stub().resolves({
          results: [{ id: 'k1', content: 'Relevant knowledge', score: 0.95 }],
        }),
      },

      performanceMonitor: {
        trackMetric: sinon.stub().resolves({ tracked: true }),
        getMetrics: sinon.stub().returns({
          accuracy: 0.92,
          responseTime: 150,
          userSatisfaction: 0.88,
          learningRate: 0.15,
        }),
        analyzePerformance: sinon.stub().resolves({
          analyzed: true,
          trends: { accuracy: 'improving', speed: 'stable' },
          recommendations: ['increase_training_frequency'],
        }),
      },

      privacyManager: {
        anonymizeData: sinon.stub().resolves({
          anonymized: true,
          dataId: 'anon123',
          privacyLevel: 'high',
        }),
        checkCompliance: sinon.stub().resolves({
          compliant: true,
          regulations: ['GDPR', 'CCPA'],
          issues: [],
        }),
        auditAccess: sinon.stub().resolves({
          audited: true,
          accessLog: [{ user: 'system', action: 'read', timestamp: Date.now() }],
        }),
      },
    };

    // Test configuration
    mockConfig = {
      learning: {
        name: 'TestLearningAdaptation',
        version: '1.0.0-test',
        enableContinuousLearning: true,
        enablePersonalization: true,
        enableModelImprovement: true,
        enableFeedbackProcessing: true,
        enableKnowledgeManagement: true,
        learningRate: 0.01,
        adaptationThreshold: 0.8,
      },

      models: {
        primaryModel: 'echo-ai-v1',
        backupModels: ['echo-ai-v0.9', 'echo-ai-baseline'],
        updateFrequency: 3600000, // 1 hour
        evaluationInterval: 86400000, // 24 hours
        minAccuracyThreshold: 0.85,
        maxModelSize: 1073741824, // 1GB
        supportedFormats: ['tensorflow', 'pytorch', 'onnx'],
      },

      personalization: {
        enabled: true,
        profileRetention: 2592000000, // 30 days
        minInteractions: 5,
        adaptationSpeed: 'medium',
        privacyLevel: 'high',
        consentRequired: true,
        anonymization: true,
      },

      feedback: {
        enabled: true,
        collectImplicit: true,
        collectExplicit: true,
        processingDelay: 300000, // 5 minutes
        batchSize: 100,
        retentionPeriod: 7776000000, // 90 days
        qualityThreshold: 0.7,
      },

      knowledge: {
        enabled: true,
        maxKnowledgeItems: 10000,
        compressionThreshold: 0.9,
        relevanceDecay: 0.95,
        updateStrategy: 'incremental',
        backupFrequency: 86400000, // 24 hours
        categories: ['user_patterns', 'domain_knowledge', 'error_patterns'],
      },

      performance: {
        monitoringEnabled: true,
        metricsRetention: 2592000000, // 30 days
        alertThresholds: {
          accuracy: 0.8,
          responseTime: 1000,
          errorRate: 0.05,
        },
        reportingInterval: 3600000, // 1 hour
      },

      privacy: {
        enabled: true,
        anonymizationLevel: 'high',
        dataRetention: 2592000000, // 30 days
        auditLogging: true,
        complianceChecks: ['GDPR', 'CCPA', 'PIPEDA'],
        encryptionRequired: true,
      },

      caching: {
        enabled: true,
        ttl: 1800000, // 30 minutes
        maxSize: 1000,
        strategy: 'lru',
      },

      services: mockServices,
    };

    // Create learning adaptation instance
    learningAdaptation = new LearningAdaptation(mockConfig);
  });

  afterEach(async () => {
    if (learningAdaptation && learningAdaptation.isRunning) {
      await learningAdaptation.stop();
    }
    await learningAdaptation?.cleanup();
    sinon.restore();
  });

  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully with valid configuration', async () => {
      await learningAdaptation.initialize();

      expect(learningAdaptation.isInitialized).to.be.true;
      expect(learningAdaptation.getStatus().initialized).to.be.true;
    });

    it('should start and stop successfully', async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();

      expect(learningAdaptation.isRunning).to.be.true;
      expect(learningAdaptation.getStatus().running).to.be.true;

      await learningAdaptation.stop();

      expect(learningAdaptation.isRunning).to.be.false;
      expect(learningAdaptation.getStatus().running).to.be.false;
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.learning.name;

      const invalidLearning = new LearningAdaptation(invalidConfig);

      try {
        await invalidLearning.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Learning adaptation name is required');
      }
    });

    it('should emit lifecycle events', async () => {
      const initSpy = sinon.spy();
      const startSpy = sinon.spy();
      const stopSpy = sinon.spy();

      learningAdaptation.on('initialized', initSpy);
      learningAdaptation.on('started', startSpy);
      learningAdaptation.on('stopped', stopSpy);

      await learningAdaptation.initialize();
      await learningAdaptation.start();
      await learningAdaptation.stop();

      expect(initSpy.calledOnce).to.be.true;
      expect(startSpy.calledOnce).to.be.true;
      expect(stopSpy.calledOnce).to.be.true;
    });
  });

  describe('Continuous Learning', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should process learning data continuously', async () => {
      const learningData = {
        userId: 'user123',
        sessionId: 'session123',
        interactions: [
          {
            input: 'Translate "hello" to Spanish',
            output: 'Hola',
            feedback: { rating: 5, helpful: true },
            context: { domain: 'basic', formality: 'informal' },
          },
          {
            input: 'How do you say "goodbye" formally?',
            output: 'Adiós (formal: Hasta luego)',
            feedback: { rating: 4, helpful: true },
            context: { domain: 'basic', formality: 'formal' },
          },
        ],
        metadata: {
          timestamp: Date.now(),
          source: 'conversation',
          quality: 0.9,
        },
      };

      const learningResult = await learningAdaptation.processLearningData(learningData);

      expect(learningResult).to.exist;
      expect(learningResult.processed).to.be.true;
      expect(learningResult.learningsExtracted).to.be.a('number');
      expect(learningResult.modelUpdated).to.be.true;
      expect(learningResult.knowledgeStored).to.be.true;
    });

    it('should adapt to user patterns', async () => {
      const userPattern = {
        userId: 'user123',
        patterns: {
          preferredLanguages: ['spanish', 'french'],
          communicationStyle: 'formal',
          responseLength: 'detailed',
          examplePreference: true,
          correctionStyle: 'gentle',
        },
        confidence: 0.85,
        sampleSize: 25,
      };

      const adaptationResult = await learningAdaptation.adaptToUserPatterns(userPattern);

      expect(adaptationResult).to.exist;
      expect(adaptationResult.adapted).to.be.true;
      expect(adaptationResult.profileUpdated).to.be.true;
      expect(adaptationResult.modelAdjusted).to.be.true;
      expect(adaptationResult.confidence).to.be.greaterThan(0.8);
    });

    it('should learn from errors and corrections', async () => {
      const errorData = {
        originalInput: 'Translate "I am happy" to Spanish',
        systemOutput: 'Estoy feliz',
        userCorrection: 'Estoy contento/a (more natural)',
        errorType: 'naturalness',
        context: {
          domain: 'emotions',
          formality: 'informal',
          region: 'latin_america',
        },
        severity: 'medium',
      };

      const errorLearning = await learningAdaptation.learnFromError(errorData);

      expect(errorLearning).to.exist;
      expect(errorLearning.learned).to.be.true;
      expect(errorLearning.errorPattern).to.exist;
      expect(errorLearning.correctionApplied).to.be.true;
      expect(errorLearning.knowledgeUpdated).to.be.true;
    });

    it('should update learning models incrementally', async () => {
      const updateData = {
        trainingBatch: [
          { input: 'data1', output: 'result1', quality: 0.9 },
          { input: 'data2', output: 'result2', quality: 0.85 },
          { input: 'data3', output: 'result3', quality: 0.92 },
        ],
        updateType: 'incremental',
        validationSet: [
          { input: 'val1', expected: 'exp1' },
          { input: 'val2', expected: 'exp2' },
        ],
      };

      const updateResult = await learningAdaptation.updateModel(updateData);

      expect(updateResult).to.exist;
      expect(updateResult.updated).to.be.true;
      expect(updateResult.improvements.accuracy).to.equal(0.05);
      expect(updateResult.improvements.speed).to.equal(0.02);
      expect(updateResult.version).to.equal('1.0.1');
    });

    it('should validate learning improvements', async () => {
      const validationRequest = {
        modelVersion: '1.0.1',
        testSet: [
          { input: 'test1', expected: 'expected1' },
          { input: 'test2', expected: 'expected2' },
          { input: 'test3', expected: 'expected3' },
        ],
        metrics: ['accuracy', 'precision', 'recall', 'f1'],
        baseline: 'model123',
      };

      const validationResult = await learningAdaptation.validateLearning(validationRequest);

      expect(validationResult).to.exist;
      expect(validationResult.accuracy).to.equal(0.92);
      expect(validationResult.precision).to.equal(0.89);
      expect(validationResult.recall).to.equal(0.91);
      expect(validationResult.f1Score).to.equal(0.9);
      expect(validationResult.improvementOverBaseline).to.be.a('number');
    });
  });

  describe('Personalization Engine', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should create user profiles', async () => {
      const profileRequest = {
        userId: 'user123',
        initialData: {
          language: 'en',
          domain: 'business',
          experience: 'intermediate',
          goals: ['improve_spanish', 'business_communication'],
        },
        consentGiven: true,
        privacyLevel: 'medium',
      };

      const profile = await learningAdaptation.createUserProfile(profileRequest);

      expect(profile).to.exist;
      expect(profile.profileId).to.equal('profile123');
      expect(profile.created).to.be.true;
      expect(profile.preferences.language).to.equal('en');
      expect(profile.preferences.domain).to.equal('business');
    });

    it('should update profiles based on interactions', async () => {
      const updateRequest = {
        userId: 'user123',
        profileId: 'profile123',
        interactions: [
          {
            type: 'translation_request',
            success: true,
            feedback: 'positive',
            context: { formality: 'formal', domain: 'legal' },
          },
          {
            type: 'correction_provided',
            correction: 'prefer_native_expressions',
            context: { language: 'spanish' },
          },
        ],
        behaviorData: {
          sessionDuration: 1800000, // 30 minutes
          interactionCount: 15,
          errorRate: 0.1,
          satisfactionScore: 0.9,
        },
      };

      const updateResult = await learningAdaptation.updateUserProfile(updateRequest);

      expect(updateResult).to.exist;
      expect(updateResult.updated).to.be.true;
      expect(updateResult.changes).to.include('preferences');
      expect(updateResult.changes).to.include('behavior_patterns');
      expect(updateResult.confidence).to.equal(0.85);
    });

    it('should provide personalized recommendations', async () => {
      const recommendationRequest = {
        userId: 'user123',
        context: {
          currentTask: 'business_translation',
          difficulty: 'intermediate',
          timeConstraint: 'normal',
        },
        recommendationTypes: ['response_style', 'content_depth', 'examples', 'explanations'],
      };

      const recommendations =
        await learningAdaptation.getPersonalizedRecommendations(recommendationRequest);

      expect(recommendations).to.exist;
      expect(recommendations.recommendations).to.be.an('array');
      expect(recommendations.recommendations.length).to.be.greaterThan(0);
      expect(recommendations.recommendations[0].type).to.equal('response_style');
      expect(recommendations.recommendations[0].value).to.equal('formal');
      expect(recommendations.recommendations[0].confidence).to.equal(0.9);
    });

    it('should analyze user preferences', async () => {
      const analysisRequest = {
        userId: 'user123',
        analysisDepth: 'comprehensive',
        timeRange: { start: Date.now() - 2592000000, end: Date.now() }, // 30 days
        includeImplicitPreferences: true,
      };

      const analysis = await learningAdaptation.analyzeUserPreferences(analysisRequest);

      expect(analysis).to.exist;
      expect(analysis.analyzed).to.be.true;
      expect(analysis.patterns).to.be.an('array');
      expect(analysis.patterns).to.include('prefers_examples');
      expect(analysis.patterns).to.include('formal_tone');
      expect(analysis.confidence).to.equal(0.88);
    });

    it('should adapt response generation', async () => {
      const adaptationRequest = {
        userId: 'user123',
        originalResponse: 'The translation is: "Hola"',
        userProfile: {
          preferences: {
            responseStyle: 'detailed',
            includeExamples: true,
            explanationLevel: 'intermediate',
          },
        },
        context: { domain: 'greetings', formality: 'informal' },
      };

      const adaptedResponse = await learningAdaptation.adaptResponse(adaptationRequest);

      expect(adaptedResponse).to.exist;
      expect(adaptedResponse.adapted).to.be.true;
      expect(adaptedResponse.response).to.include('Hola');
      expect(adaptedResponse.personalizationApplied).to.be.true;
      expect(adaptedResponse.confidence).to.be.greaterThan(0.8);
    });
  });

  describe('Feedback Processing', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should process explicit feedback', async () => {
      const explicitFeedback = {
        userId: 'user123',
        sessionId: 'session123',
        interactionId: 'interaction123',
        feedbackType: 'rating',
        rating: 4,
        comments: 'Good translation but could be more natural',
        categories: ['accuracy', 'naturalness'],
        timestamp: Date.now(),
      };

      const feedbackResult = await learningAdaptation.processExplicitFeedback(explicitFeedback);

      expect(feedbackResult).to.exist;
      expect(feedbackResult.processed).to.be.true;
      expect(feedbackResult.feedbackId).to.equal('feedback123');
      expect(feedbackResult.sentiment).to.equal('positive');
      expect(feedbackResult.actionItems).to.include('improve_accuracy');
    });

    it('should process implicit feedback', async () => {
      const implicitFeedback = {
        userId: 'user123',
        behaviorData: {
          timeSpent: 45000, // 45 seconds
          scrollBehavior: 'quick_scan',
          copyAction: true,
          followUpQuestions: 0,
          sessionContinued: true,
        },
        interactionData: {
          responseUsed: true,
          modificationsRequested: 1,
          satisfactionIndicators: ['copied_result', 'continued_session'],
        },
        contextData: {
          taskCompleted: true,
          errorOccurred: false,
          helpRequested: false,
        },
      };

      const implicitResult = await learningAdaptation.processImplicitFeedback(implicitFeedback);

      expect(implicitResult).to.exist;
      expect(implicitResult.processed).to.be.true;
      expect(implicitResult.satisfactionScore).to.be.a('number');
      expect(implicitResult.behaviorInsights).to.be.an('array');
      expect(implicitResult.learningPoints).to.be.an('array');
    });

    it('should analyze feedback patterns', async () => {
      const analysisRequest = {
        timeRange: { start: Date.now() - 604800000, end: Date.now() }, // 7 days
        userId: 'user123',
        feedbackTypes: ['explicit', 'implicit'],
        analysisDepth: 'detailed',
      };

      const analysis = await learningAdaptation.analyzeFeedbackPatterns(analysisRequest);

      expect(analysis).to.exist;
      expect(analysis.analyzed).to.be.true;
      expect(analysis.insights.satisfaction).to.equal(0.85);
      expect(analysis.insights.areas_for_improvement).to.include('response_time');
      expect(analysis.insights.positive_aspects).to.include('helpfulness');
    });

    it('should extract actionable learnings from feedback', async () => {
      const extractionRequest = {
        feedbackBatch: [
          {
            rating: 3,
            comment: 'Translation is correct but too formal',
            context: { domain: 'casual', formality: 'informal' },
          },
          {
            rating: 5,
            comment: 'Perfect! Exactly what I needed',
            context: { domain: 'business', formality: 'formal' },
          },
          {
            rating: 2,
            comment: 'Missing context, unclear meaning',
            context: { domain: 'technical', complexity: 'high' },
          },
        ],
        extractionStrategy: 'pattern_analysis',
      };

      const learnings = await learningAdaptation.extractLearningsFromFeedback(extractionRequest);

      expect(learnings).to.exist;
      expect(learnings.learnings).to.be.an('array');
      expect(learnings.learnings.length).to.be.greaterThan(0);
      expect(learnings.learnings[0].type).to.equal('user_preference');
      expect(learnings.learnings[0].weight).to.equal(0.8);
    });

    it('should prioritize feedback for learning', async () => {
      const prioritizationRequest = {
        feedbackQueue: [
          { id: 'f1', priority: 'high', impact: 0.9, recency: 0.95 },
          { id: 'f2', priority: 'medium', impact: 0.7, recency: 0.8 },
          { id: 'f3', priority: 'low', impact: 0.5, recency: 0.6 },
        ],
        processingCapacity: 2,
        prioritizationStrategy: 'impact_weighted',
      };

      const prioritization = await learningAdaptation.prioritizeFeedback(prioritizationRequest);

      expect(prioritization).to.exist;
      expect(prioritization.prioritized).to.be.true;
      expect(prioritization.selectedFeedback).to.have.length(2);
      expect(prioritization.selectedFeedback[0].id).to.equal('f1');
    });
  });

  describe('Knowledge Management', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should store and organize knowledge', async () => {
      const knowledgeItem = {
        content: 'Users in business domain prefer formal translations',
        category: 'user_patterns',
        domain: 'business',
        confidence: 0.9,
        source: 'feedback_analysis',
        tags: ['formality', 'business', 'user_preference'],
        metadata: {
          sampleSize: 150,
          timeRange: '30_days',
          validation: 'peer_reviewed',
        },
      };

      const storageResult = await learningAdaptation.storeKnowledge(knowledgeItem);

      expect(storageResult).to.exist;
      expect(storageResult.stored).to.be.true;
      expect(storageResult.knowledgeId).to.equal('knowledge123');
      expect(storageResult.category).to.equal('user_patterns');
    });

    it('should retrieve relevant knowledge', async () => {
      const retrievalRequest = {
        query: 'business translation preferences',
        context: {
          domain: 'business',
          user_type: 'professional',
          task: 'formal_translation',
        },
        maxResults: 5,
        minRelevance: 0.7,
        categories: ['user_patterns', 'domain_knowledge'],
      };

      const knowledge = await learningAdaptation.retrieveKnowledge(retrievalRequest);

      expect(knowledge).to.exist;
      expect(knowledge.knowledge).to.be.an('array');
      expect(knowledge.knowledge.length).to.be.greaterThan(0);
      expect(knowledge.knowledge[0].relevance).to.equal(0.9);
      expect(knowledge.knowledge[0].content).to.include('formal tone');
    });

    it('should update knowledge based on new evidence', async () => {
      const updateRequest = {
        knowledgeId: 'knowledge123',
        newEvidence: {
          supportingData: [
            { observation: 'User corrected to formal', weight: 0.8 },
            { observation: 'Positive feedback on formal response', weight: 0.9 },
          ],
          contradictingData: [
            { observation: 'User preferred casual in one instance', weight: 0.3 },
          ],
        },
        updateStrategy: 'weighted_average',
      };

      const updateResult = await learningAdaptation.updateKnowledge(updateRequest);

      expect(updateResult).to.exist;
      expect(updateResult.updated).to.be.true;
      expect(updateResult.confidenceChange).to.be.a('number');
      expect(updateResult.evidenceIncorporated).to.be.true;
    });

    it('should search knowledge semantically', async () => {
      const searchRequest = {
        query: 'How do users prefer error corrections?',
        searchType: 'semantic',
        context: {
          domain: 'language_learning',
          user_level: 'beginner',
        },
        filters: {
          categories: ['user_patterns', 'error_patterns'],
          minConfidence: 0.8,
          recency: '90_days',
        },
      };

      const searchResults = await learningAdaptation.searchKnowledge(searchRequest);

      expect(searchResults).to.exist;
      expect(searchResults.results).to.be.an('array');
      expect(searchResults.results[0].score).to.equal(0.95);
      expect(searchResults.totalResults).to.be.a('number');
    });

    it('should compress and optimize knowledge base', async () => {
      const optimizationRequest = {
        compressionThreshold: 0.9,
        redundancyRemoval: true,
        relevanceFiltering: true,
        knowledgeAging: true,
        targetSize: 8000, // items
      };

      const optimization = await learningAdaptation.optimizeKnowledgeBase(optimizationRequest);

      expect(optimization).to.exist;
      expect(optimization.optimized).to.be.true;
      expect(optimization.compressionRatio).to.be.a('number');
      expect(optimization.itemsRemoved).to.be.a('number');
      expect(optimization.qualityMaintained).to.be.greaterThan(0.95);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should track learning performance metrics', async () => {
      const metricsData = {
        learningSession: 'session123',
        metrics: {
          accuracy: 0.92,
          learningRate: 0.15,
          adaptationSpeed: 0.08,
          knowledgeRetention: 0.89,
          userSatisfaction: 0.88,
        },
        timestamp: Date.now(),
        context: {
          modelVersion: '1.0.1',
          dataSize: 1000,
          processingTime: 2500,
        },
      };

      const trackingResult = await learningAdaptation.trackPerformanceMetrics(metricsData);

      expect(trackingResult).to.exist;
      expect(trackingResult.tracked).to.be.true;
      expect(trackingResult.metricsStored).to.be.a('number');
      expect(trackingResult.alertsTriggered).to.be.an('array');
    });

    it('should analyze performance trends', async () => {
      const analysisRequest = {
        timeRange: { start: Date.now() - 604800000, end: Date.now() }, // 7 days
        metrics: ['accuracy', 'learningRate', 'userSatisfaction'],
        analysisType: 'trend_analysis',
        includeComparisons: true,
      };

      const trendAnalysis = await learningAdaptation.analyzePerformanceTrends(analysisRequest);

      expect(trendAnalysis).to.exist;
      expect(trendAnalysis.analyzed).to.be.true;
      expect(trendAnalysis.trends.accuracy).to.equal('improving');
      expect(trendAnalysis.trends.speed).to.equal('stable');
      expect(trendAnalysis.recommendations).to.include('increase_training_frequency');
    });

    it('should detect performance anomalies', async () => {
      const anomalyDetection = await learningAdaptation.detectPerformanceAnomalies({
        metrics: ['accuracy', 'responseTime', 'errorRate'],
        sensitivityLevel: 'medium',
        timeWindow: 3600000, // 1 hour
        baselineComparison: true,
      });

      expect(anomalyDetection).to.exist;
      expect(anomalyDetection.anomaliesDetected).to.be.a('number');
      expect(anomalyDetection.severity).to.be.a('string');
      expect(anomalyDetection.recommendations).to.be.an('array');
    });

    it('should generate performance reports', async () => {
      const reportRequest = {
        reportType: 'comprehensive',
        timeRange: { start: Date.now() - 2592000000, end: Date.now() }, // 30 days
        includeMetrics: ['learning', 'adaptation', 'user_satisfaction'],
        includeComparisons: true,
        includeRecommendations: true,
      };

      const report = await learningAdaptation.generatePerformanceReport(reportRequest);

      expect(report).to.exist;
      expect(report.summary).to.exist;
      expect(report.metrics).to.exist;
      expect(report.trends).to.exist;
      expect(report.recommendations).to.exist;
      expect(report.generatedAt).to.be.a('number');
    });
  });

  describe('Privacy and Security', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should anonymize sensitive data', async () => {
      const sensitiveData = {
        userId: 'user123',
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          location: 'New York',
        },
        conversationData: [
          { message: 'My name is John and I live in New York', timestamp: Date.now() },
          { message: 'I work at Acme Corp', timestamp: Date.now() },
        ],
        preferences: {
          language: 'en',
          domain: 'business',
        },
      };

      const anonymizationResult = await learningAdaptation.anonymizeData(sensitiveData);

      expect(anonymizationResult).to.exist;
      expect(anonymizationResult.anonymized).to.be.true;
      expect(anonymizationResult.dataId).to.equal('anon123');
      expect(anonymizationResult.privacyLevel).to.equal('high');
    });

    it('should check compliance with privacy regulations', async () => {
      const complianceCheck = {
        dataTypes: ['personal_info', 'behavioral_data', 'preferences'],
        regulations: ['GDPR', 'CCPA', 'PIPEDA'],
        processingPurpose: 'service_improvement',
        consentStatus: 'given',
        retentionPeriod: 2592000000, // 30 days
      };

      const complianceResult = await learningAdaptation.checkPrivacyCompliance(complianceCheck);

      expect(complianceResult).to.exist;
      expect(complianceResult.compliant).to.be.true;
      expect(complianceResult.regulations).to.include('GDPR');
      expect(complianceResult.regulations).to.include('CCPA');
      expect(complianceResult.issues).to.have.length(0);
    });

    it('should audit data access and usage', async () => {
      const auditRequest = {
        dataId: 'anon123',
        timeRange: { start: Date.now() - 86400000, end: Date.now() }, // 24 hours
        includeSystemAccess: true,
        includeUserAccess: false,
      };

      const auditResult = await learningAdaptation.auditDataAccess(auditRequest);

      expect(auditResult).to.exist;
      expect(auditResult.audited).to.be.true;
      expect(auditResult.accessLog).to.be.an('array');
      expect(auditResult.accessLog[0].user).to.equal('system');
      expect(auditResult.accessLog[0].action).to.equal('read');
    });

    it('should handle data deletion requests', async () => {
      const deletionRequest = {
        userId: 'user123',
        dataTypes: ['profile', 'interactions', 'preferences'],
        deletionReason: 'user_request',
        verificationToken: 'token123',
        permanentDeletion: true,
      };

      const deletionResult = await learningAdaptation.handleDataDeletion(deletionRequest);

      expect(deletionResult).to.exist;
      expect(deletionResult.deleted).to.be.true;
      expect(deletionResult.dataTypesDeleted).to.include('profile');
      expect(deletionResult.verificationRequired).to.be.false;
      expect(deletionResult.completionTime).to.be.a('number');
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should handle model update failures gracefully', async () => {
      // Mock model update failure
      mockServices.modelManager.updateModel.rejects(new Error('Model update failed'));

      const updateData = {
        trainingBatch: [{ input: 'test', output: 'result' }],
        updateType: 'incremental',
      };

      const updateResult = await learningAdaptation.updateModel(updateData);

      expect(updateResult).to.exist;
      expect(updateResult.updated).to.be.false;
      expect(updateResult.error).to.exist;
      expect(updateResult.fallbackUsed).to.be.true;
      expect(updateResult.recoveryAction).to.exist;
    });

    it('should recover from knowledge base corruption', async () => {
      const recoveryRequest = {
        corruptionType: 'index_corruption',
        affectedCategories: ['user_patterns'],
        recoveryStrategy: 'rebuild_from_backup',
        validateIntegrity: true,
      };

      const recoveryResult = await learningAdaptation.recoverKnowledgeBase(recoveryRequest);

      expect(recoveryResult).to.exist;
      expect(recoveryResult.recovered).to.be.true;
      expect(recoveryResult.recoveryMethod).to.equal('rebuild_from_backup');
      expect(recoveryResult.dataIntegrity).to.be.greaterThan(0.95);
      expect(recoveryResult.itemsRecovered).to.be.a('number');
    });

    it('should maintain learning continuity during errors', async () => {
      // Simulate various service failures
      mockServices.feedbackProcessor.processFeedback.rejects(new Error('Feedback service down'));

      const learningData = {
        userId: 'user123',
        interactions: [{ input: 'test', output: 'result', feedback: { rating: 5 } }],
      };

      const learningResult = await learningAdaptation.processLearningData(learningData);

      expect(learningResult.processed).to.be.true;
      expect(learningResult.partialSuccess).to.be.true;
      expect(learningResult.failedComponents).to.include('feedback_processing');
      expect(learningResult.continuityMaintained).to.be.true;
    });
  });

  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      await learningAdaptation.initialize();
      await learningAdaptation.start();
    });

    it('should collect comprehensive learning statistics', async () => {
      // Generate learning activity
      await learningAdaptation.processLearningData({
        userId: 'user1',
        interactions: [{ input: 'test1', output: 'result1', feedback: { rating: 5 } }],
      });

      await learningAdaptation.processLearningData({
        userId: 'user2',
        interactions: [{ input: 'test2', output: 'result2', feedback: { rating: 4 } }],
      });

      const statistics = learningAdaptation.getStatistics();

      expect(statistics).to.exist;
      expect(statistics.totalLearningEvents).to.be.greaterThan(0);
      expect(statistics.totalUsers).to.be.greaterThan(0);
      expect(statistics.averageLearningRate).to.be.a('number');
      expect(statistics.modelAccuracy).to.be.a('number');
      expect(statistics.knowledgeBaseSize).to.be.a('number');
      expect(statistics.userSatisfactionScore).to.be.a('number');
    });

    it('should generate detailed analytics reports', async () => {
      const reportRequest = {
        timeRange: { start: Date.now() - 604800000, end: Date.now() }, // 7 days
        includeDetails: true,
        metrics: [
          'learning_efficiency',
          'adaptation_success',
          'user_engagement',
          'model_performance',
        ],
      };

      const report = learningAdaptation.generateAnalyticsReport(reportRequest);

      expect(report).to.exist;
      expect(report.summary).to.exist;
      expect(report.learningMetrics).to.exist;
      expect(report.adaptationMetrics).to.exist;
      expect(report.userEngagement).to.exist;
      expect(report.modelPerformance).to.exist;
      expect(report.recommendations).to.exist;
    });
  });
});
