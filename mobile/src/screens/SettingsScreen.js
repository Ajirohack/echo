/**
 * Echo Mobile App - Settings Screen
 * App configuration and user preferences
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useEcho } from '../providers/EchoProvider';
import { useAudio } from '../providers/AudioProvider';
import { THEME } from '../constants/theme';
import Logger from '../utils/Logger';
import { PermissionsManager } from '../utils/permissions';
import { StorageManager } from '../utils/storage';

const SettingsScreen = ({ navigation }) => {
  const [settings, setSettings] = useState({
    autoTranslate: true,
    saveRecordings: true,
    highQualityAudio: false,
    darkMode: false,
    notifications: true,
    autoPlayTranslations: false,
    keepScreenOn: true,
    vibrationFeedback: true,
  });

  const [permissions, setPermissions] = useState({
    microphone: 'unknown',
    notifications: 'unknown',
  });

  const [storageInfo, setStorageInfo] = useState({
    usedSpace: 0,
    totalRecordings: 0,
    totalTranslations: 0,
  });

  const { state: echoState, actions: echoActions } = useEcho();
  const { state: audioState, actions: audioActions } = useAudio();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    checkPermissions();
    loadStorageInfo();
  }, []);

  // Load user settings
  const loadSettings = async () => {
    try {
      const savedSettings = await StorageManager.getItem('userSettings');
      if (savedSettings) {
        setSettings({ ...settings, ...savedSettings });
      }
    } catch (error) {
      Logger.error('SettingsScreen', 'Error loading settings:', error);
    }
  };

  // Save settings
  const saveSettings = async (newSettings) => {
    try {
      await StorageManager.setItem('userSettings', newSettings);
      setSettings(newSettings);

      // Apply settings to providers
      await echoActions.updateSettings(newSettings);
      await audioActions.updateSettings(newSettings);

    } catch (error) {
      Logger.error('SettingsScreen', 'Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  // Check permissions status
  const checkPermissions = async () => {
    try {
      const micStatus = await PermissionsManager.checkPermission('microphone');
      const notifStatus = await PermissionsManager.checkPermission('notifications');

      setPermissions({
        microphone: micStatus,
        notifications: notifStatus,
      });
    } catch (error) {
      Logger.error('SettingsScreen', 'Error checking permissions:', error);
    }
  };

  // Load storage information
  const loadStorageInfo = async () => {
    try {
      const history = await echoActions.getTranslationHistory();
      const recordings = await audioActions.getRecordings();

      // Calculate storage usage (simplified)
      const usedSpace = (history?.length || 0) * 0.1 + (recordings?.length || 0) * 2; // MB estimate

      setStorageInfo({
        usedSpace: usedSpace.toFixed(1),
        totalRecordings: recordings?.length || 0,
        totalTranslations: history?.length || 0,
      });
    } catch (error) {
      Logger.error('SettingsScreen', 'Error loading storage info:', error);
    }
  };

  // Toggle setting
  const toggleSetting = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  // Request permission
  const requestPermission = async (type) => {
    try {
      let result;
      if (type === 'microphone') {
        result = await PermissionsManager.requestPermission('microphone', {
          showRationale: true,
          rationale: 'Echo needs microphone access to record audio for translation.',
        });
      } else if (type === 'notifications') {
        result = await PermissionsManager.requestPermission('notifications', {
          showRationale: true,
          rationale: 'Echo can send notifications about translation status.',
        });
      }

      await checkPermissions();

      if (result !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'You can enable this permission in Settings app.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      Logger.error('SettingsScreen', 'Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request permission');
    }
  };

  // Clear all data
  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all recordings, translations, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await echoActions.clearAllData();
              await audioActions.clearAllData();
              await StorageManager.clear();

              // Reset settings to defaults
              const defaultSettings = {
                autoTranslate: true,
                saveRecordings: true,
                highQualityAudio: false,
                darkMode: false,
                notifications: true,
                autoPlayTranslations: false,
                keepScreenOn: true,
                vibrationFeedback: true,
              };

              setSettings(defaultSettings);
              await loadStorageInfo();

              Alert.alert('Success', 'All data has been cleared');
            } catch (error) {
              Logger.error('SettingsScreen', 'Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear all data');
            }
          }
        }
      ]
    );
  };

  // Export data
  const exportData = async () => {
    try {
      Alert.alert('Export Data', 'Export functionality coming soon');
    } catch (error) {
      Logger.error('SettingsScreen', 'Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    }
  };

  // Get permission status color
  const getPermissionColor = (status) => {
    switch (status) {
      case 'granted': return THEME.colors.success;
      case 'denied': return THEME.colors.error;
      default: return THEME.colors.warning;
    }
  };

  // Get permission status text
  const getPermissionText = (status) => {
    switch (status) {
      case 'granted': return 'Granted';
      case 'denied': return 'Denied';
      default: return 'Unknown';
    }
  };

  // Render setting row
  const renderSettingRow = (title, subtitle, value, onToggle, type = 'switch') => {
    return React.createElement(View, { style: styles.settingRow },
      React.createElement(View, { style: styles.settingInfo },
        React.createElement(Text, { style: styles.settingTitle }, title),
        subtitle && React.createElement(Text, { style: styles.settingSubtitle }, subtitle)
      ),
      type === 'switch' ?
        React.createElement(Switch, {
          value: value,
          onValueChange: onToggle,
          trackColor: {
            false: THEME.colors.border,
            true: THEME.colors.primary + '40'
          },
          thumbColor: value ? THEME.colors.primary : THEME.colors.textSecondary,
        }) :
        React.createElement(TouchableOpacity, {
          style: styles.settingButton,
          onPress: onToggle
        }, React.createElement(Text, { style: styles.settingButtonText }, value))
    );
  };

  // Render permission row
  const renderPermissionRow = (title, subtitle, status, onPress) => {
    return React.createElement(TouchableOpacity, {
      style: styles.permissionRow,
      onPress: onPress
    },
      React.createElement(View, { style: styles.settingInfo },
        React.createElement(Text, { style: styles.settingTitle }, title),
        subtitle && React.createElement(Text, { style: styles.settingSubtitle }, subtitle)
      ),
      React.createElement(View, { style: styles.permissionStatus },
        React.createElement(View, {
          style: [
            styles.permissionDot,
            { backgroundColor: getPermissionColor(status) }
          ]
        }),
        React.createElement(Text, {
          style: [
            styles.permissionText,
            { color: getPermissionColor(status) }
          ]
        }, getPermissionText(status))
      )
    );
  };

  return React.createElement(ScrollView, {
    style: styles.container,
    contentContainerStyle: styles.contentContainer
  },
    // Header
    React.createElement(View, { style: styles.header },
      React.createElement(TouchableOpacity, {
        style: styles.backButton,
        onPress: () => navigation.goBack()
      }, React.createElement(Text, { style: styles.backIcon }, '←')),
      React.createElement(Text, { style: styles.headerTitle }, 'Settings'),
      React.createElement(View, { style: styles.headerSpacer })
    ),

    // App Settings Section
    React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'App Settings'),

      renderSettingRow(
        'Auto Translate',
        'Automatically start translation after recording',
        settings.autoTranslate,
        () => toggleSetting('autoTranslate')
      ),

      renderSettingRow(
        'Save Recordings',
        'Keep audio recordings after translation',
        settings.saveRecordings,
        () => toggleSetting('saveRecordings')
      ),

      renderSettingRow(
        'High Quality Audio',
        'Use higher quality recording (uses more storage)',
        settings.highQualityAudio,
        () => toggleSetting('highQualityAudio')
      ),

      renderSettingRow(
        'Auto-play Translations',
        'Automatically play translated audio',
        settings.autoPlayTranslations,
        () => toggleSetting('autoPlayTranslations')
      ),

      renderSettingRow(
        'Keep Screen On',
        'Prevent screen from turning off during recording',
        settings.keepScreenOn,
        () => toggleSetting('keepScreenOn')
      ),

      renderSettingRow(
        'Vibration Feedback',
        'Vibrate on recording start/stop',
        settings.vibrationFeedback,
        () => toggleSetting('vibrationFeedback')
      )
    ),

    // Permissions Section
    React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Permissions'),

      renderPermissionRow(
        'Microphone',
        'Required for audio recording',
        permissions.microphone,
        () => requestPermission('microphone')
      ),

      renderPermissionRow(
        'Notifications',
        'Optional for translation status updates',
        permissions.notifications,
        () => requestPermission('notifications')
      )
    ),

    // Storage Section
    React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Storage'),

      React.createElement(View, { style: styles.storageInfo },
        React.createElement(View, { style: styles.storageItem },
          React.createElement(Text, { style: styles.storageLabel }, 'Used Space'),
          React.createElement(Text, { style: styles.storageValue }, `${storageInfo.usedSpace} MB`)
        ),
        React.createElement(View, { style: styles.storageItem },
          React.createElement(Text, { style: styles.storageLabel }, 'Recordings'),
          React.createElement(Text, { style: styles.storageValue }, storageInfo.totalRecordings.toString())
        ),
        React.createElement(View, { style: styles.storageItem },
          React.createElement(Text, { style: styles.storageLabel }, 'Translations'),
          React.createElement(Text, { style: styles.storageValue }, storageInfo.totalTranslations.toString())
        )
      ),

      React.createElement(TouchableOpacity, {
        style: styles.actionButton,
        onPress: exportData
      }, React.createElement(Text, { style: styles.actionButtonText }, '📤 Export Data')),

      React.createElement(TouchableOpacity, {
        style: [styles.actionButton, styles.dangerButton],
        onPress: clearAllData
      }, React.createElement(Text, { style: [styles.actionButtonText, styles.dangerButtonText] }, '🗑️ Clear All Data'))
    ),

    // About Section
    React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'About'),

      React.createElement(View, { style: styles.aboutInfo },
        React.createElement(Text, { style: styles.aboutTitle }, 'Echo Mobile'),
        React.createElement(Text, { style: styles.aboutVersion }, 'Version 1.0.0'),
        React.createElement(Text, { style: styles.aboutDescription },
          'Real-time audio translation powered by advanced AI'
        )
      ),

      React.createElement(TouchableOpacity, {
        style: styles.linkButton,
        onPress: () => Alert.alert('Privacy Policy', 'Privacy policy coming soon')
      }, React.createElement(Text, { style: styles.linkButtonText }, 'Privacy Policy')),

      React.createElement(TouchableOpacity, {
        style: styles.linkButton,
        onPress: () => Alert.alert('Terms of Service', 'Terms of service coming soon')
      }, React.createElement(Text, { style: styles.linkButtonText }, 'Terms of Service')),

      React.createElement(TouchableOpacity, {
        style: styles.linkButton,
        onPress: () => Alert.alert('Support', 'Support contact coming soon')
      }, React.createElement(Text, { style: styles.linkButtonText }, 'Contact Support'))
    )
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  contentContainer: {
    paddingBottom: THEME.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.xl,
    paddingBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: THEME.spacing.sm,
    marginRight: THEME.spacing.md,
  },
  backIcon: {
    fontSize: 24,
    color: THEME.colors.primary,
  },
  headerTitle: {
    flex: 1,
    fontSize: THEME.typography.sizes.lg,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  section: {
    backgroundColor: THEME.colors.surface,
    marginTop: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
  },
  settingButton: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.primary + '20',
    borderRadius: THEME.borderRadius.sm,
  },
  settingButtonText: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.primary,
    fontWeight: THEME.typography.weights.medium,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  permissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: THEME.spacing.xs,
  },
  permissionText: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: THEME.typography.weights.medium,
  },
  storageInfo: {
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.lg,
  },
  storageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
  },
  storageLabel: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
  },
  storageValue: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.primary,
    fontWeight: THEME.typography.weights.semibold,
  },
  actionButton: {
    backgroundColor: THEME.colors.primary,
    marginHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: THEME.colors.white,
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
  },
  dangerButton: {
    backgroundColor: THEME.colors.error,
  },
  dangerButtonText: {
    color: THEME.colors.white,
  },
  aboutInfo: {
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.lg,
  },
  aboutTitle: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.xs,
  },
  aboutVersion: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  aboutDescription: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkButton: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  linkButtonText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.primary,
  },
});

export default SettingsScreen;