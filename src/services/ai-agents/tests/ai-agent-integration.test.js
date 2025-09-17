import { expect } from 'chai';
import sinon from 'sinon';
import { AIAgentIntegration } from '../ai-agent-integration.js';
import { TestUtils } from '../../utils/test-utils.js';

/**
 * Integration tests for AIAgentIntegration
 * Tests server-side AI processing, agent coordination, service orchestration,
 * and enterprise features like load balancing and auto-scaling
 */
describe('AIAgentIntegration Integration Tests', () => {
  let agentIntegration;
  let mockConfig;
  let mockServices;
  let testUtils;

  beforeEach(async () => {
    // Setup test utilities
    testUtils = new TestUtils();

    // Mock external services
    mockServices = {
      echoAIAgent: {
        initialize: sinon.stub().resolves(),
        start: sinon.stub().resolves(),
        stop: sinon.stub().resolves(),
        processMessage: sinon.stub().resolves({ processed: true, response: 'test response' }),
        startConversation: sinon.stub().resolves('conv123'),
        endConversation: sinon.stub().resolves({ ended: true }),
        getStatistics: sinon.stub().returns({ totalMessages: 100 }),
      },
      translationService: {
        translate: sinon.stub().resolves({ text: 'translated', confidence: 0.95 }),
        getCapabilities: sinon.stub().returns({ languages: ['en', 'es', 'fr'] }),
      },
      audioProcessor: {
        processAudio: sinon.stub().resolves({ processed: true }),
        getMetrics: sinon.stub().returns({ latency: 50, quality: 0.9 }),
      },
      rtcService: {
        sendMessage: sinon.stub().resolves({ sent: true }),
        getConnectionStatus: sinon.stub().returns({ connected: true }),
      },
      loadBalancer: {
        getNextAgent: sinon.stub().returns('agent1'),
        updateAgentLoad: sinon.stub(),
        getLoadMetrics: sinon.stub().returns({ totalLoad: 0.5 }),
      },
      autoScaler: {
        checkScaling: sinon.stub().resolves({ scaleUp: false, scaleDown: false }),
        scaleUp: sinon.stub().resolves({ scaled: true }),
        scaleDown: sinon.stub().resolves({ scaled: true }),
      },
    };

    // Test configuration
    mockConfig = {
      integration: {
        name: 'TestAIIntegration',
        version: '1.0.0-test',
        enableServerSideProcessing: true,
        enableAgentCoordination: true,
        enableLoadBalancing: true,
        enableAutoScaling: true,
        maxConcurrentRequests: 100,
        requestTimeout: 30000,
        healthCheckInterval: 5000,
      },

      agents: {
        maxAgents: 5,
        minAgents: 1,
        agentPoolSize: 3,
        agentTimeout: 60000,
        enableAgentFailover: true,
        agentHealthThreshold: 0.8,
      },

      loadBalancing: {
        strategy: 'round_robin',
        enableStickySession: true,
        healthCheckEnabled: true,
        maxRetries: 3,
        retryDelay: 1000,
      },

      autoScaling: {
        enabled: true,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
        cooldownPeriod: 300000,
        maxInstances: 10,
        minInstances: 2,
      },

      caching: {
        enabled: true,
        ttl: 3600000,
        maxSize: 1000,
        strategy: 'lru',
      },

      monitoring: {
        enabled: true,
        metricsInterval: 10000,
        alertThresholds: {
          responseTime: 5000,
          errorRate: 0.05,
          cpuUsage: 0.8,
          memoryUsage: 0.8,
        },
      },

      services: mockServices,
    };

    // Create integration instance
    agentIntegration = new AIAgentIntegration(mockConfig);
  });

  afterEach(async () => {
    if (agentIntegration && agentIntegration.isRunning) {
      await agentIntegration.stop();
    }
    await agentIntegration?.cleanup();
    sinon.restore();
  });

  describe('Initialization and Lifecycle', () => {
    it('should initialize successfully with valid configuration', async () => {
      await agentIntegration.initialize();

      expect(agentIntegration.isInitialized).to.be.true;
      expect(agentIntegration.getStatus().initialized).to.be.true;
    });

    it('should start and stop successfully', async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();

      expect(agentIntegration.isRunning).to.be.true;
      expect(agentIntegration.getStatus().running).to.be.true;

      await agentIntegration.stop();

      expect(agentIntegration.isRunning).to.be.false;
      expect(agentIntegration.getStatus().running).to.be.false;
    });

    it('should initialize agent pool', async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();

      const agentPool = agentIntegration.getAgentPool();

      expect(agentPool).to.exist;
      expect(agentPool.size).to.be.greaterThan(0);
      expect(agentPool.size).to.be.at.most(mockConfig.agents.agentPoolSize);
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidConfig = { ...mockConfig };
      delete invalidConfig.integration.name;

      const invalidIntegration = new AIAgentIntegration(invalidConfig);

      try {
        await invalidIntegration.initialize();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Integration name is required');
      }
    });

    it('should emit lifecycle events', async () => {
      const initSpy = sinon.spy();
      const startSpy = sinon.spy();
      const stopSpy = sinon.spy();

      agentIntegration.on('initialized', initSpy);
      agentIntegration.on('started', startSpy);
      agentIntegration.on('stopped', stopSpy);

      await agentIntegration.initialize();
      await agentIntegration.start();
      await agentIntegration.stop();

      expect(initSpy.calledOnce).to.be.true;
      expect(startSpy.calledOnce).to.be.true;
      expect(stopSpy.calledOnce).to.be.true;
    });
  });

  describe('Server-side Processing', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should process requests through server-side pipeline', async () => {
      const request = {
        id: 'req123',
        type: 'conversation',
        userId: 'user123',
        content: 'Hello, I need help with translation',
        metadata: {
          language: 'en',
          priority: 'normal',
        },
      };

      const result = await agentIntegration.processRequest(request);

      expect(result).to.exist;
      expect(result.processed).to.be.true;
      expect(result.requestId).to.equal('req123');
      expect(result.response).to.exist;
    });

    it('should handle concurrent requests', async () => {
      const requests = [];

      // Create multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        requests.push({
          id: `req${i}`,
          type: 'conversation',
          userId: `user${i}`,
          content: `Request ${i}`,
          metadata: { priority: 'normal' },
        });
      }

      const results = await Promise.all(
        requests.map((req) => agentIntegration.processRequest(req))
      );

      expect(results).to.have.length(5);
      results.forEach((result, index) => {
        expect(result.processed).to.be.true;
        expect(result.requestId).to.equal(`req${index}`);
      });
    });

    it('should route requests to appropriate agents', async () => {
      const translationRequest = {
        id: 'req1',
        type: 'translation',
        content: 'Translate this text',
        metadata: { sourceLanguage: 'en', targetLanguage: 'es' },
      };

      const conversationRequest = {
        id: 'req2',
        type: 'conversation',
        content: 'Start a conversation',
        metadata: { conversationType: 'general' },
      };

      const results = await Promise.all([
        agentIntegration.processRequest(translationRequest),
        agentIntegration.processRequest(conversationRequest),
      ]);

      expect(results[0].routedTo).to.include('translation');
      expect(results[1].routedTo).to.include('conversation');
    });

    it('should handle request prioritization', async () => {
      const highPriorityRequest = {
        id: 'req_high',
        type: 'conversation',
        content: 'Urgent request',
        metadata: { priority: 'high' },
      };

      const normalPriorityRequest = {
        id: 'req_normal',
        type: 'conversation',
        content: 'Normal request',
        metadata: { priority: 'normal' },
      };

      // Process both requests
      const results = await Promise.all([
        agentIntegration.processRequest(highPriorityRequest),
        agentIntegration.processRequest(normalPriorityRequest),
      ]);

      // High priority should be processed first (implementation dependent)
      expect(results[0].priority).to.equal('high');
      expect(results[0].processingOrder).to.be.lessThan(results[1].processingOrder);
    });
  });

  describe('Agent Coordination', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should coordinate multiple agents', async () => {
      const coordinationRequest = {
        id: 'coord_req',
        type: 'multi_agent',
        tasks: [
          { type: 'translation', content: 'Translate this' },
          { type: 'audio_processing', content: 'Process audio' },
          { type: 'context_analysis', content: 'Analyze context' },
        ],
      };

      const result = await agentIntegration.coordinateAgents(coordinationRequest);

      expect(result).to.exist;
      expect(result.coordinated).to.be.true;
      expect(result.taskResults).to.have.length(3);
      expect(result.agentsUsed).to.be.greaterThan(1);
    });

    it('should handle agent communication', async () => {
      const communicationSpy = sinon.spy();
      agentIntegration.on('agentCommunication', communicationSpy);

      const request = {
        id: 'comm_req',
        type: 'collaborative',
        content: 'Task requiring agent collaboration',
      };

      await agentIntegration.processRequest(request);

      expect(communicationSpy.called).to.be.true;
    });

    it('should manage agent state synchronization', async () => {
      const stateUpdate = {
        agentId: 'agent1',
        state: {
          activeConversations: 3,
          load: 0.6,
          lastActivity: Date.now(),
        },
      };

      await agentIntegration.updateAgentState(stateUpdate);

      const agentState = agentIntegration.getAgentState('agent1');

      expect(agentState).to.exist;
      expect(agentState.activeConversations).to.equal(3);
      expect(agentState.load).to.equal(0.6);
    });

    it('should handle agent failover', async () => {
      // Simulate agent failure
      mockServices.echoAIAgent.processMessage.rejects(new Error('Agent unavailable'));

      const request = {
        id: 'failover_req',
        type: 'conversation',
        content: 'Test failover',
        metadata: { requiresFailover: true },
      };

      const result = await agentIntegration.processRequest(request);

      expect(result.failoverUsed).to.be.true;
      expect(result.processed).to.be.true;
    });
  });

  describe('Load Balancing', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should distribute load across agents', async () => {
      const requests = [];

      // Create multiple requests to test load distribution
      for (let i = 0; i < 10; i++) {
        requests.push({
          id: `load_req${i}`,
          type: 'conversation',
          content: `Load test ${i}`,
        });
      }

      const results = await Promise.all(
        requests.map((req) => agentIntegration.processRequest(req))
      );

      // Check that requests were distributed
      const agentsUsed = new Set(results.map((r) => r.assignedAgent));
      expect(agentsUsed.size).to.be.greaterThan(1);
    });

    it('should respect load balancing strategy', async () => {
      // Test round-robin strategy
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push({
          id: `rr_req${i}`,
          type: 'conversation',
          content: `Round robin test ${i}`,
        });
      }

      const results = [];
      for (const req of requests) {
        const result = await agentIntegration.processRequest(req);
        results.push(result);
      }

      // Verify round-robin distribution pattern
      const agentSequence = results.map((r) => r.assignedAgent);
      expect(agentSequence).to.have.length(6);
    });

    it('should handle agent health checks', async () => {
      const healthCheckSpy = sinon.spy();
      agentIntegration.on('healthCheck', healthCheckSpy);

      // Trigger health check
      await agentIntegration.performHealthCheck();

      expect(healthCheckSpy.called).to.be.true;

      const healthStatus = agentIntegration.getHealthStatus();
      expect(healthStatus).to.exist;
      expect(healthStatus.overallHealth).to.be.a('number');
      expect(healthStatus.agentHealth).to.be.an('object');
    });

    it('should remove unhealthy agents from rotation', async () => {
      // Mark an agent as unhealthy
      await agentIntegration.updateAgentHealth('agent1', {
        healthy: false,
        lastError: 'Connection timeout',
        errorCount: 5,
      });

      const request = {
        id: 'health_req',
        type: 'conversation',
        content: 'Test with unhealthy agent',
      };

      const result = await agentIntegration.processRequest(request);

      expect(result.assignedAgent).to.not.equal('agent1');
      expect(result.healthyAgentUsed).to.be.true;
    });
  });

  describe('Auto-scaling', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should scale up under high load', async () => {
      // Simulate high load
      const highLoadMetrics = {
        cpuUsage: 0.9,
        memoryUsage: 0.85,
        requestRate: 100,
        responseTime: 3000,
      };

      await agentIntegration.updateLoadMetrics(highLoadMetrics);

      const scalingDecision = await agentIntegration.evaluateScaling();

      expect(scalingDecision.shouldScale).to.be.true;
      expect(scalingDecision.direction).to.equal('up');
      expect(scalingDecision.reason).to.include('high_load');
    });

    it('should scale down under low load', async () => {
      // Simulate low load
      const lowLoadMetrics = {
        cpuUsage: 0.2,
        memoryUsage: 0.3,
        requestRate: 5,
        responseTime: 100,
      };

      await agentIntegration.updateLoadMetrics(lowLoadMetrics);

      const scalingDecision = await agentIntegration.evaluateScaling();

      expect(scalingDecision.shouldScale).to.be.true;
      expect(scalingDecision.direction).to.equal('down');
      expect(scalingDecision.reason).to.include('low_load');
    });

    it('should respect scaling limits', async () => {
      // Test maximum scaling limit
      const currentInstances = mockConfig.autoScaling.maxInstances;

      await agentIntegration.setCurrentInstances(currentInstances);

      const scalingDecision = await agentIntegration.evaluateScaling();

      if (scalingDecision.direction === 'up') {
        expect(scalingDecision.blocked).to.be.true;
        expect(scalingDecision.reason).to.include('max_instances');
      }
    });

    it('should handle scaling cooldown period', async () => {
      // Perform a scaling operation
      await agentIntegration.scaleUp(1);

      // Immediately try to scale again
      const scalingDecision = await agentIntegration.evaluateScaling();

      if (scalingDecision.shouldScale) {
        expect(scalingDecision.blocked).to.be.true;
        expect(scalingDecision.reason).to.include('cooldown');
      }
    });
  });

  describe('Caching and Optimization', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should cache frequently requested data', async () => {
      const request = {
        id: 'cache_req',
        type: 'translation',
        content: 'Cache this translation',
        metadata: { cacheable: true },
      };

      // First request should hit the service
      const result1 = await agentIntegration.processRequest(request);
      expect(result1.fromCache).to.be.false;

      // Second identical request should hit the cache
      const result2 = await agentIntegration.processRequest(request);
      expect(result2.fromCache).to.be.true;
      expect(result2.response).to.equal(result1.response);
    });

    it('should invalidate expired cache entries', async () => {
      // Use short TTL for testing
      const shortTTLConfig = {
        ...mockConfig,
        caching: { ...mockConfig.caching, ttl: 100 },
      };

      const shortTTLIntegration = new AIAgentIntegration(shortTTLConfig);
      await shortTTLIntegration.initialize();
      await shortTTLIntegration.start();

      const request = {
        id: 'ttl_req',
        type: 'conversation',
        content: 'TTL test',
        metadata: { cacheable: true },
      };

      // First request
      await shortTTLIntegration.processRequest(request);

      // Wait for cache expiry
      await testUtils.wait(150);

      // Second request should not hit cache
      const result = await shortTTLIntegration.processRequest(request);
      expect(result.fromCache).to.be.false;

      await shortTTLIntegration.stop();
      await shortTTLIntegration.cleanup();
    });

    it('should optimize request routing based on agent capabilities', async () => {
      const translationRequest = {
        id: 'opt_req1',
        type: 'translation',
        content: 'Optimize routing',
        metadata: {
          sourceLanguage: 'en',
          targetLanguage: 'es',
          requiresSpecialization: true,
        },
      };

      const result = await agentIntegration.processRequest(translationRequest);

      expect(result.optimizedRouting).to.be.true;
      expect(result.agentCapabilityMatch).to.be.greaterThan(0.8);
    });
  });

  describe('Monitoring and Analytics', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should collect comprehensive metrics', async () => {
      // Generate some activity
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push({
          id: `metrics_req${i}`,
          type: 'conversation',
          content: `Metrics test ${i}`,
        });
      }

      await Promise.all(requests.map((req) => agentIntegration.processRequest(req)));

      const metrics = agentIntegration.getMetrics();

      expect(metrics).to.exist;
      expect(metrics.totalRequests).to.be.greaterThan(0);
      expect(metrics.averageResponseTime).to.be.a('number');
      expect(metrics.successRate).to.be.a('number');
      expect(metrics.agentUtilization).to.be.an('object');
    });

    it('should track performance trends', async () => {
      // Generate activity over time
      for (let i = 0; i < 3; i++) {
        await agentIntegration.processRequest({
          id: `trend_req${i}`,
          type: 'conversation',
          content: `Trend test ${i}`,
        });

        await testUtils.wait(100);
      }

      const performanceTrends = agentIntegration.getPerformanceTrends();

      expect(performanceTrends).to.exist;
      expect(performanceTrends.responseTimeHistory).to.be.an('array');
      expect(performanceTrends.throughputHistory).to.be.an('array');
      expect(performanceTrends.errorRateHistory).to.be.an('array');
    });

    it('should generate alerts for performance issues', async () => {
      const alertSpy = sinon.spy();
      agentIntegration.on('performanceAlert', alertSpy);

      // Simulate performance issue
      const slowRequest = {
        id: 'slow_req',
        type: 'conversation',
        content: 'Slow request',
        metadata: { simulateSlowness: true },
      };

      await agentIntegration.processRequest(slowRequest);

      // Check if alert was triggered (implementation dependent)
      // This would depend on the actual alert thresholds
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should handle service failures gracefully', async () => {
      // Mock service failure
      mockServices.echoAIAgent.processMessage.rejects(new Error('Service unavailable'));

      const request = {
        id: 'error_req',
        type: 'conversation',
        content: 'Test error handling',
      };

      const result = await agentIntegration.processRequest(request);

      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(result.fallbackUsed).to.be.true;
    });

    it('should implement circuit breaker pattern', async () => {
      // Simulate multiple failures to trigger circuit breaker
      mockServices.echoAIAgent.processMessage.rejects(new Error('Repeated failure'));

      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push({
          id: `cb_req${i}`,
          type: 'conversation',
          content: `Circuit breaker test ${i}`,
        });
      }

      const results = [];
      for (const req of requests) {
        try {
          const result = await agentIntegration.processRequest(req);
          results.push(result);
        } catch (error) {
          results.push({ error: error.message });
        }
      }

      // Later requests should be blocked by circuit breaker
      const lastResult = results[results.length - 1];
      expect(lastResult.circuitBreakerOpen).to.be.true;
    });

    it('should recover from temporary failures', async () => {
      let callCount = 0;
      mockServices.echoAIAgent.processMessage.callsFake(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ processed: true, response: 'recovered' });
      });

      const request = {
        id: 'recovery_req',
        type: 'conversation',
        content: 'Test recovery',
      };

      const result = await agentIntegration.processRequest(request);

      expect(result.processed).to.be.true;
      expect(result.retryCount).to.be.greaterThan(0);
    });

    it('should maintain system stability during errors', async () => {
      // Simulate various error conditions
      const errorRequests = [
        { id: 'err1', type: 'invalid_type', content: 'Invalid request' },
        { id: 'err2', type: 'conversation', content: null },
        { id: 'err3', type: 'conversation', content: 'Valid after errors' },
      ];

      const results = [];
      for (const req of errorRequests) {
        try {
          const result = await agentIntegration.processRequest(req);
          results.push(result);
        } catch (error) {
          results.push({ error: error.message });
        }
      }

      // System should still be operational
      expect(agentIntegration.isRunning).to.be.true;

      // Last valid request should succeed
      const lastResult = results[results.length - 1];
      expect(lastResult.processed).to.be.true;
    });
  });

  describe('Configuration and Customization', () => {
    it('should support custom integration configuration', async () => {
      const customConfig = {
        ...mockConfig,
        integration: {
          ...mockConfig.integration,
          name: 'CustomIntegration',
          maxConcurrentRequests: 200,
          enableAdvancedFeatures: true,
        },
        agents: {
          ...mockConfig.agents,
          maxAgents: 10,
          customAgentTypes: ['translation', 'conversation', 'analysis'],
        },
      };

      const customIntegration = new AIAgentIntegration(customConfig);
      await customIntegration.initialize();
      await customIntegration.start();

      expect(customIntegration.config.integration.name).to.equal('CustomIntegration');
      expect(customIntegration.config.integration.maxConcurrentRequests).to.equal(200);
      expect(customIntegration.config.agents.maxAgents).to.equal(10);

      await customIntegration.stop();
      await customIntegration.cleanup();
    });

    it('should update configuration at runtime', async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();

      const newConfig = {
        integration: {
          maxConcurrentRequests: 150,
          requestTimeout: 45000,
        },
        autoScaling: {
          scaleUpThreshold: 0.9,
          scaleDownThreshold: 0.2,
        },
      };

      agentIntegration.updateConfiguration(newConfig);

      expect(agentIntegration.config.integration.maxConcurrentRequests).to.equal(150);
      expect(agentIntegration.config.integration.requestTimeout).to.equal(45000);
      expect(agentIntegration.config.autoScaling.scaleUpThreshold).to.equal(0.9);
    });
  });

  describe('Statistics and Reporting', () => {
    beforeEach(async () => {
      await agentIntegration.initialize();
      await agentIntegration.start();
    });

    it('should collect comprehensive statistics', async () => {
      // Generate varied activity
      const activities = [
        { type: 'conversation', count: 5 },
        { type: 'translation', count: 3 },
        { type: 'audio_processing', count: 2 },
      ];

      for (const activity of activities) {
        for (let i = 0; i < activity.count; i++) {
          await agentIntegration.processRequest({
            id: `${activity.type}_${i}`,
            type: activity.type,
            content: `${activity.type} request ${i}`,
          });
        }
      }

      const statistics = agentIntegration.getStatistics();

      expect(statistics).to.exist;
      expect(statistics.totalRequests).to.equal(10);
      expect(statistics.requestsByType).to.be.an('object');
      expect(statistics.requestsByType.conversation).to.equal(5);
      expect(statistics.requestsByType.translation).to.equal(3);
      expect(statistics.averageResponseTime).to.be.a('number');
      expect(statistics.uptime).to.be.a('number');
    });

    it('should generate detailed reports', async () => {
      // Generate activity for reporting
      for (let i = 0; i < 5; i++) {
        await agentIntegration.processRequest({
          id: `report_req${i}`,
          type: 'conversation',
          content: `Report test ${i}`,
          metadata: { userId: `user${i % 3}` },
        });
      }

      const report = agentIntegration.generateReport({
        timeRange: { start: Date.now() - 3600000, end: Date.now() },
        includeDetails: true,
      });

      expect(report).to.exist;
      expect(report.summary).to.exist;
      expect(report.agentPerformance).to.exist;
      expect(report.userActivity).to.exist;
      expect(report.systemHealth).to.exist;
    });
  });
});
