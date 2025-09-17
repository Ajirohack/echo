/**
 * Echo Mobile App - Main Application Component
 * Real-time voice translation with AI-powered communication
 */

import React, { useEffect, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

// Navigation
import AppNavigator from './navigation/AppNavigator';

// Providers
import { EchoProvider } from './providers/EchoProvider';
import { AudioProvider } from './providers/AudioProvider';
import { TranslationProvider } from './providers/TranslationProvider';
import { NetworkProvider } from './providers/NetworkProvider';

// Services
import { PermissionManager } from './services/PermissionManager';
import { AudioManager } from './services/AudioManager';
import { NotificationManager } from './services/NotificationManager';
import { ErrorReportingService } from './services/ErrorReportingService';

// Utils
import { Logger } from './utils/Logger';
import { DeviceInfo } from './utils/DeviceInfo';

// Constants
import { COLORS, THEME } from './constants/theme';

const App = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    initializeApp();
    setupAppStateListener();
    setupNetworkListener();

    return () => {
      cleanup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      Logger.info('App', 'Initializing Echo Mobile App');

      // Initialize device info
      await DeviceInfo.initialize();

      // Request permissions
      const permissionsGranted = await PermissionManager.requestAllPermissions();
      if (!permissionsGranted) {
        Alert.alert(
          'Permissions Required',
          'Echo needs microphone and other permissions to function properly. Please grant permissions in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => PermissionManager.openSettings() },
          ]
        );
      }

      // Initialize audio system
      await AudioManager.initialize();

      // Initialize notification system
      await NotificationManager.initialize();

      // Initialize error reporting
      ErrorReportingService.initialize();

      setIsInitialized(true);
      Logger.info('App', 'App initialization completed');
    } catch (error) {
      Logger.error('App', 'Failed to initialize app:', error);
      ErrorReportingService.reportError(error, 'App Initialization');
      
      Alert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please restart the application.',
        [{ text: 'OK' }]
      );
    }
  };

  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState) => {
      Logger.info('App', `App state changed: ${appState} -> ${nextAppState}`);
      
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        handleAppForeground();
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        handleAppBackground();
      }
      
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      Logger.info('App', `Network state changed:`, state);
      setNetworkStatus(state);
      
      if (!state.isConnected) {
        NotificationManager.showLocalNotification(
          'Network Disconnected',
          'Echo is working offline. Some features may be limited.'
        );
      }
    });

    return unsubscribe;
  };

  const handleAppForeground = async () => {
    try {
      // Refresh network status
      const networkState = await NetInfo.fetch();
      setNetworkStatus(networkState);
      
      // Resume audio if needed
      await AudioManager.resumeIfNeeded();
      
      Logger.info('App', 'App resumed from background');
    } catch (error) {
      Logger.error('App', 'Error handling app foreground:', error);
    }
  };

  const handleAppBackground = async () => {
    try {
      // Pause non-essential services
      await AudioManager.pauseIfNeeded();
      
      Logger.info('App', 'App moved to background');
    } catch (error) {
      Logger.error('App', 'Error handling app background:', error);
    }
  };

  const cleanup = () => {
    Logger.info('App', 'Cleaning up app resources');
    AudioManager.cleanup();
    NotificationManager.cleanup();
  };

  if (!isInitialized) {
    // You can replace this with a proper splash screen component
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.background.primary}
          translucent={false}
        />
        {/* Splash screen will be added here */}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <EchoProvider>
          <NetworkProvider networkStatus={networkStatus}>
            <AudioProvider>
              <TranslationProvider>
                <NavigationContainer theme={THEME.navigation}>
                  <StatusBar
                    barStyle="light-content"
                    backgroundColor={COLORS.background.primary}
                    translucent={false}
                  />
                  <AppNavigator />
                </NavigationContainer>
              </TranslationProvider>
            </AudioProvider>
          </NetworkProvider>
        </EchoProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;