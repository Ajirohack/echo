/**
 * Echo RTC Service - Main Entry Point
 * Exports all Echo RTC components and provides a unified interface
 */

const EchoRTCService = require('./echo-rtc-service');
const EchoRTCRoomManager = require('./room-manager');
const PeerConnectionManager = require('./peer-connection-manager');
const echoRTCConfig = require('./config');
const { logger } = require('../../utils/logger');

/**
 * Echo RTC Factory
 * Creates and manages Echo RTC service instances
 */
class EchoRTCFactory {
  constructor() {
    this.instances = new Map();
    this.defaultInstance = null;
  }

  /**
   * Create Echo RTC service instance
   * @param {string} instanceId - Instance identifier
   * @param {Object} config - Configuration options
   * @returns {Object} Echo RTC service components
   */
  createInstance(instanceId = 'default', config = {}) {
    try {
      if (this.instances.has(instanceId)) {
        logger.warn(`Echo RTC instance '${instanceId}' already exists`);
        return this.instances.get(instanceId);
      }

      // Merge configuration
      const instanceConfig = {
        ...echoRTCConfig.getAll(),
        ...config,
      };

      // Create service components
      const echoRTCService = new EchoRTCService(instanceConfig);
      const roomManager = new EchoRTCRoomManager(echoRTCService);
      const peerConnectionManager = new PeerConnectionManager(instanceConfig);

      // Set up inter-component communication
      this.setupComponentIntegration(echoRTCService, roomManager, peerConnectionManager);

      const instance = {
        id: instanceId,
        service: echoRTCService,
        roomManager,
        peerConnectionManager,
        config: instanceConfig,
        createdAt: Date.now(),
      };

      this.instances.set(instanceId, instance);

      if (instanceId === 'default') {
        this.defaultInstance = instance;
      }

      logger.info(`Created Echo RTC instance: ${instanceId}`);
      return instance;
    } catch (error) {
      logger.error(`Failed to create Echo RTC instance '${instanceId}':`, error);
      throw error;
    }
  }

  /**
   * Set up integration between components
   * @private
   * @param {EchoRTCService} service - Echo RTC service
   * @param {EchoRTCRoomManager} roomManager - Room manager
   * @param {PeerConnectionManager} peerManager - Peer connection manager
   */
  setupComponentIntegration(service, roomManager, peerManager) {
    // Forward peer connection events to service
    peerManager.on('iceCandidate', (data) => {
      service.emit('iceCandidate', data);
    });

    peerManager.on('remoteStream', (data) => {
      service.emit('remoteStream', data);
    });

    peerManager.on('translationReceived', (data) => {
      service.emit('translationReceived', data);
    });

    peerManager.on('connectionEstablished', (data) => {
      service.emit('peerConnectionEstablished', data);
    });

    peerManager.on('connectionFailed', (data) => {
      service.emit('peerConnectionFailed', data);
    });

    // Forward room events to service
    roomManager.on('roomCreated', (data) => {
      service.emit('roomCreated', data);
    });

    roomManager.on('participantJoined', (data) => {
      service.emit('participantJoined', data);
    });

    roomManager.on('participantLeft', (data) => {
      service.emit('participantLeft', data);
    });

    // Forward service events to components
    service.on('audioForTranslation', (data) => {
      roomManager.emit('audioForTranslation', data);
    });

    service.on('translation', (data) => {
      peerManager.broadcastTranslation(data.translation, data.excludeParticipant);
    });
  }

  /**
   * Get Echo RTC instance
   * @param {string} instanceId - Instance identifier
   * @returns {Object|null} Echo RTC instance
   */
  getInstance(instanceId = 'default') {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Get default instance
   * @returns {Object|null} Default Echo RTC instance
   */
  getDefaultInstance() {
    return this.defaultInstance;
  }

  /**
   * Destroy Echo RTC instance
   * @param {string} instanceId - Instance identifier
   * @returns {Promise<void>}
   */
  async destroyInstance(instanceId) {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        logger.warn(`Echo RTC instance '${instanceId}' not found`);
        return;
      }

      // Disconnect service
      if (instance.service) {
        await instance.service.disconnect();
      }

      // Close all peer connections
      if (instance.peerConnectionManager) {
        instance.peerConnectionManager.closeAllConnections();
      }

      // Remove from instances
      this.instances.delete(instanceId);

      if (instanceId === 'default') {
        this.defaultInstance = null;
      }

      logger.info(`Destroyed Echo RTC instance: ${instanceId}`);
    } catch (error) {
      logger.error(`Failed to destroy Echo RTC instance '${instanceId}':`, error);
      throw error;
    }
  }

  /**
   * Destroy all instances
   * @returns {Promise<void>}
   */
  async destroyAllInstances() {
    const instanceIds = Array.from(this.instances.keys());

    for (const instanceId of instanceIds) {
      await this.destroyInstance(instanceId);
    }

    logger.info('Destroyed all Echo RTC instances');
  }

  /**
   * Get all instances
   * @returns {Array} List of instances
   */
  getAllInstances() {
    return Array.from(this.instances.values());
  }

  /**
   * Get factory statistics
   * @returns {Object} Factory statistics
   */
  getStatistics() {
    const stats = {
      totalInstances: this.instances.size,
      instances: [],
    };

    this.instances.forEach((instance, instanceId) => {
      stats.instances.push({
        id: instanceId,
        createdAt: instance.createdAt,
        uptime: Date.now() - instance.createdAt,
        isConnected: instance.service?.isConnected || false,
        activeRooms: instance.roomManager?.getActiveRooms().length || 0,
        activeConnections: instance.peerConnectionManager?.getStatistics().activeConnections || 0,
      });
    });

    return stats;
  }
}

// Create singleton factory
const echoRTCFactory = new EchoRTCFactory();

/**
 * Convenience functions for default instance
 */

/**
 * Initialize default Echo RTC instance
 * @param {Object} config - Configuration options
 * @param {Object} translationManager - Translation manager instance
 * @returns {Promise<Object>} Echo RTC instance
 */
async function initialize(config = {}, translationManager = null) {
  try {
    const instance = echoRTCFactory.createInstance('default', config);

    if (translationManager) {
      await instance.service.initialize(translationManager);
    }

    logger.info('Echo RTC default instance initialized');
    return instance;
  } catch (error) {
    logger.error('Failed to initialize Echo RTC default instance:', error);
    throw error;
  }
}

/**
 * Get default Echo RTC service
 * @returns {EchoRTCService|null} Echo RTC service
 */
function getService() {
  const instance = echoRTCFactory.getDefaultInstance();
  return instance ? instance.service : null;
}

/**
 * Get default room manager
 * @returns {EchoRTCRoomManager|null} Room manager
 */
function getRoomManager() {
  const instance = echoRTCFactory.getDefaultInstance();
  return instance ? instance.roomManager : null;
}

/**
 * Get default peer connection manager
 * @returns {PeerConnectionManager|null} Peer connection manager
 */
function getPeerConnectionManager() {
  const instance = echoRTCFactory.getDefaultInstance();
  return instance ? instance.peerConnectionManager : null;
}

/**
 * Create room using default instance
 * @param {string} roomName - Room name
 * @param {Object} config - Room configuration
 * @returns {Promise<Object>} Room creation result
 */
async function createRoom(roomName, config = {}) {
  const roomManager = getRoomManager();
  if (!roomManager) {
    throw new Error('Echo RTC not initialized');
  }

  return await roomManager.createRoom(roomName, config);
}

/**
 * Join room using default instance
 * @param {string} roomName - Room name
 * @param {Object} participant - Participant information
 * @param {string} password - Room password
 * @returns {Promise<Object>} Join result
 */
async function joinRoom(roomName, participant, password = null) {
  const roomManager = getRoomManager();
  if (!roomManager) {
    throw new Error('Echo RTC not initialized');
  }

  return await roomManager.joinRoom(roomName, participant, password);
}

/**
 * Leave room using default instance
 * @param {string} roomName - Room name
 * @param {string} participantId - Participant ID
 * @returns {Promise<Object>} Leave result
 */
async function leaveRoom(roomName, participantId) {
  const roomManager = getRoomManager();
  if (!roomManager) {
    throw new Error('Echo RTC not initialized');
  }

  return await roomManager.leaveRoom(roomName, participantId);
}

/**
 * Disconnect default instance
 * @returns {Promise<void>}
 */
async function disconnect() {
  const service = getService();
  if (service) {
    await service.disconnect();
  }
}

/**
 * Get Echo RTC status
 * @returns {Object} Status information
 */
function getStatus() {
  const instance = echoRTCFactory.getDefaultInstance();
  if (!instance) {
    return {
      initialized: false,
      connected: false,
      activeRooms: 0,
      activeConnections: 0,
    };
  }

  return {
    initialized: instance.service.isInitialized,
    connected: instance.service.isConnected,
    activeRooms: instance.roomManager.getActiveRooms().length,
    activeConnections: instance.peerConnectionManager.getStatistics().activeConnections,
    uptime: Date.now() - instance.createdAt,
  };
}

// Export everything
module.exports = {
  // Core classes
  EchoRTCService,
  EchoRTCRoomManager,
  PeerConnectionManager,

  // Configuration
  config: echoRTCConfig,

  // Factory
  factory: echoRTCFactory,

  // Convenience functions
  initialize,
  getService,
  getRoomManager,
  getPeerConnectionManager,
  createRoom,
  joinRoom,
  leaveRoom,
  disconnect,
  getStatus,

  // Version info
  version: '1.0.0',
  name: 'Echo RTC Service',
};
