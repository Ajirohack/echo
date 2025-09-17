/**
 * Echo Mobile App - Permissions Utility
 * Handles device permissions for audio, camera, location, and other features
 */

import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Camera from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import Logger from './Logger';

/**
 * Permission types supported by the app
 */
export const PERMISSION_TYPES = {
  AUDIO_RECORDING: 'audio_recording',
  CAMERA: 'camera',
  LOCATION: 'location',
  MEDIA_LIBRARY: 'media_library',
  NOTIFICATIONS: 'notifications',
};

/**
 * Permission status values
 */
export const PERMISSION_STATUS = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
  RESTRICTED: 'restricted', // iOS only
};

/**
 * Permission error types
 */
export const PERMISSION_ERRORS = {
  NOT_AVAILABLE: 'PERMISSION_NOT_AVAILABLE',
  DENIED: 'PERMISSION_DENIED',
  RESTRICTED: 'PERMISSION_RESTRICTED',
  UNKNOWN: 'PERMISSION_UNKNOWN_ERROR',
};

/**
 * Permission utility class
 */
class PermissionsManager {
  constructor() {
    this.logger = Logger;
    this.permissionCache = new Map();
    this.requestInProgress = new Set();
  }

  /**
   * Check if a permission is granted
   * @param {string} permissionType - Permission type from PERMISSION_TYPES
   * @returns {Promise<boolean>} True if permission is granted
   */
  async isGranted(permissionType) {
    try {
      const status = await this.getStatus(permissionType);
      return status === PERMISSION_STATUS.GRANTED;
    } catch (error) {
      this.logger.error('PermissionsManager', 'Error checking permission status:', error);
      return false;
    }
  }

  /**
   * Get the current status of a permission
   * @param {string} permissionType - Permission type from PERMISSION_TYPES
   * @returns {Promise<string>} Permission status
   */
  async getStatus(permissionType) {
    try {
      // Check cache first
      if (this.permissionCache.has(permissionType)) {
        const cached = this.permissionCache.get(permissionType);
        const now = Date.now();
        // Cache for 30 seconds
        if (now - cached.timestamp < 30000) {
          return cached.status;
        }
      }

      let status;

      switch (permissionType) {
        case PERMISSION_TYPES.AUDIO_RECORDING:
          status = await this._getAudioRecordingStatus();
          break;
        case PERMISSION_TYPES.CAMERA:
          status = await this._getCameraStatus();
          break;
        case PERMISSION_TYPES.LOCATION:
          status = await this._getLocationStatus();
          break;
        case PERMISSION_TYPES.MEDIA_LIBRARY:
          status = await this._getMediaLibraryStatus();
          break;
        case PERMISSION_TYPES.NOTIFICATIONS:
          status = await this._getNotificationStatus();
          break;
        default:
          throw new Error(`Unknown permission type: ${permissionType}`);
      }

      // Cache the result
      this.permissionCache.set(permissionType, {
        status,
        timestamp: Date.now(),
      });

      return status;
    } catch (error) {
      this.logger.error('PermissionsManager', `Error getting status for ${permissionType}:`, error);
      throw error;
    }
  }

  /**
   * Request a permission
   * @param {string} permissionType - Permission type from PERMISSION_TYPES
   * @param {Object} options - Request options
   * @returns {Promise<string>} Permission status after request
   */
  async request(permissionType, options = {}) {
    try {
      // Prevent multiple simultaneous requests for the same permission
      if (this.requestInProgress.has(permissionType)) {
        this.logger.warn('PermissionsManager', `Permission request already in progress for ${permissionType}`);
        return await this.getStatus(permissionType);
      }

      this.requestInProgress.add(permissionType);

      try {
        // Check current status first
        const currentStatus = await this.getStatus(permissionType);
        if (currentStatus === PERMISSION_STATUS.GRANTED) {
          return currentStatus;
        }

        // Show rationale if needed and not already denied
        if (options.showRationale && currentStatus === PERMISSION_STATUS.UNDETERMINED) {
          const shouldRequest = await this._showPermissionRationale(permissionType, options.rationale);
          if (!shouldRequest) {
            return PERMISSION_STATUS.DENIED;
          }
        }

        let status;

        switch (permissionType) {
          case PERMISSION_TYPES.AUDIO_RECORDING:
            status = await this._requestAudioRecording();
            break;
          case PERMISSION_TYPES.CAMERA:
            status = await this._requestCamera();
            break;
          case PERMISSION_TYPES.LOCATION:
            status = await this._requestLocation(options);
            break;
          case PERMISSION_TYPES.MEDIA_LIBRARY:
            status = await this._requestMediaLibrary();
            break;
          case PERMISSION_TYPES.NOTIFICATIONS:
            status = await this._requestNotifications();
            break;
          default:
            throw new Error(`Unknown permission type: ${permissionType}`);
        }

        // Clear cache to force refresh
        this.permissionCache.delete(permissionType);

        // Show settings prompt if permission was denied and user wants to
        if (status === PERMISSION_STATUS.DENIED && options.showSettingsPrompt) {
          await this._showSettingsPrompt(permissionType);
        }

        this.logger.info('PermissionsManager', `Permission ${permissionType} request result: ${status}`);
        return status;
      } finally {
        this.requestInProgress.delete(permissionType);
      }
    } catch (error) {
      this.logger.error('PermissionsManager', `Error requesting permission ${permissionType}:`, error);
      throw error;
    }
  }

  /**
   * Request multiple permissions
   * @param {string[]} permissionTypes - Array of permission types
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Object with permission types as keys and statuses as values
   */
  async requestMultiple(permissionTypes, options = {}) {
    const results = {};

    // Request permissions sequentially to avoid conflicts
    for (const permissionType of permissionTypes) {
      try {
        results[permissionType] = await this.request(permissionType, options);
      } catch (error) {
        this.logger.error('PermissionsManager', `Error requesting ${permissionType}:`, error);
        results[permissionType] = PERMISSION_STATUS.DENIED;
      }
    }

    return results;
  }

  /**
   * Check if all specified permissions are granted
   * @param {string[]} permissionTypes - Array of permission types
   * @returns {Promise<boolean>} True if all permissions are granted
   */
  async areAllGranted(permissionTypes) {
    try {
      const results = await Promise.all(
        permissionTypes.map(type => this.isGranted(type))
      );
      return results.every(granted => granted);
    } catch (error) {
      this.logger.error('PermissionsManager', 'Error checking multiple permissions:', error);
      return false;
    }
  }

  /**
   * Open device settings for the app
   */
  async openSettings() {
    try {
      await Linking.openSettings();
    } catch (error) {
      this.logger.error('PermissionsManager', 'Error opening settings:', error);
      throw error;
    }
  }

  /**
   * Clear permission cache
   */
  clearCache() {
    this.permissionCache.clear();
  }

  // Private methods for specific permissions

  async _getAudioRecordingStatus() {
    const { status } = await Audio.getPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _requestAudioRecording() {
    const { status } = await Audio.requestPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _getCameraStatus() {
    const { status } = await Camera.getCameraPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _requestCamera() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _getLocationStatus() {
    const { status } = await Location.getForegroundPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _requestLocation(options = {}) {
    const { accuracy = Location.Accuracy.Balanced } = options;
    const { status } = await Location.requestForegroundPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _getMediaLibraryStatus() {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _requestMediaLibrary() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return this._mapExpoStatus(status);
  }

  async _getNotificationStatus() {
    // This would need to be implemented with expo-notifications
    // For now, return undetermined
    return PERMISSION_STATUS.UNDETERMINED;
  }

  async _requestNotifications() {
    // This would need to be implemented with expo-notifications
    // For now, return undetermined
    return PERMISSION_STATUS.UNDETERMINED;
  }

  /**
   * Map Expo permission status to our standard status
   * @param {string} expoStatus - Expo permission status
   * @returns {string} Mapped status
   */
  _mapExpoStatus(expoStatus) {
    switch (expoStatus) {
      case 'granted':
        return PERMISSION_STATUS.GRANTED;
      case 'denied':
        return PERMISSION_STATUS.DENIED;
      case 'undetermined':
        return PERMISSION_STATUS.UNDETERMINED;
      default:
        return PERMISSION_STATUS.DENIED;
    }
  }

  /**
   * Show permission rationale dialog
   * @param {string} permissionType - Permission type
   * @param {string} rationale - Custom rationale message
   * @returns {Promise<boolean>} True if user wants to proceed
   */
  async _showPermissionRationale(permissionType, rationale) {
    return new Promise((resolve) => {
      const defaultRationales = {
        [PERMISSION_TYPES.AUDIO_RECORDING]: 'Echo needs access to your microphone to record and translate audio messages.',
        [PERMISSION_TYPES.CAMERA]: 'Echo needs access to your camera to capture images and videos.',
        [PERMISSION_TYPES.LOCATION]: 'Echo needs access to your location to provide location-based features.',
        [PERMISSION_TYPES.MEDIA_LIBRARY]: 'Echo needs access to your media library to save and share content.',
      };

      const message = rationale || defaultRationales[permissionType] || 'This permission is required for the app to function properly.';

      Alert.alert(
        'Permission Required',
        message,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continue',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show settings prompt when permission is denied
   * @param {string} permissionType - Permission type
   * @returns {Promise<void>}
   */
  async _showSettingsPrompt(permissionType) {
    return new Promise((resolve) => {
      const permissionNames = {
        [PERMISSION_TYPES.AUDIO_RECORDING]: 'Microphone',
        [PERMISSION_TYPES.CAMERA]: 'Camera',
        [PERMISSION_TYPES.LOCATION]: 'Location',
        [PERMISSION_TYPES.MEDIA_LIBRARY]: 'Media Library',
      };

      const permissionName = permissionNames[permissionType] || 'Permission';

      Alert.alert(
        'Permission Denied',
        `${permissionName} access is required for this feature. You can enable it in Settings.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(),
          },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await this.openSettings();
              } catch (error) {
                this.logger.error('PermissionsManager', 'Error opening settings:', error);
              }
              resolve();
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Get debug information about permissions
   * @returns {Object} Debug information
   */
  async getDebugInfo() {
    const info = {
      platform: Platform.OS,
      permissions: {},
      cache: {},
      requestsInProgress: Array.from(this.requestInProgress),
    };

    // Get status for all permission types
    for (const [key, permissionType] of Object.entries(PERMISSION_TYPES)) {
      try {
        info.permissions[key] = await this.getStatus(permissionType);
      } catch (error) {
        info.permissions[key] = `Error: ${error.message}`;
      }
    }

    // Get cache info
    this.permissionCache.forEach((value, key) => {
      info.cache[key] = {
        status: value.status,
        age: Date.now() - value.timestamp,
      };
    });

    return info;
  }
}

// Create singleton instance
const permissionsManager = new PermissionsManager();

// Export convenience functions
export const isPermissionGranted = (permissionType) => permissionsManager.isGranted(permissionType);
export const getPermissionStatus = (permissionType) => permissionsManager.getStatus(permissionType);
export const requestPermission = (permissionType, options) => permissionsManager.request(permissionType, options);
export const requestMultiplePermissions = (permissionTypes, options) => permissionsManager.requestMultiple(permissionTypes, options);
export const areAllPermissionsGranted = (permissionTypes) => permissionsManager.areAllGranted(permissionTypes);
export const openAppSettings = () => permissionsManager.openSettings();
export const clearPermissionCache = () => permissionsManager.clearCache();

// Export the manager instance
export default permissionsManager;