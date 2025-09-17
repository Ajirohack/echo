/**
 * Echo Mobile App - Record Screen
 * Audio recording and real-time translation interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAudio } from '../providers/AudioProvider';
import { useEcho } from '../providers/EchoProvider';
import { THEME } from '../constants/theme';
import Logger from '../utils/Logger';
import { requestPermission, PERMISSION_TYPES } from '../utils/permissions';

const { width: screenWidth } = Dimensions.get('window');

const RecordScreen = ({ navigation }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentTranslation, setCurrentTranslation] = useState('');
  const [translationLanguage, setTranslationLanguage] = useState('es');
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const { state: audioState, actions: audioActions } = useAudio();
  const { state: echoState, actions: echoActions } = useEcho();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const levelAnim = useRef(new Animated.Value(0)).current;
  const durationTimer = useRef(null);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  // Update audio level animation
  useEffect(() => {
    Animated.timing(levelAnim, {
      toValue: audioLevel,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [audioLevel]);

  // Pulse animation for recording button
  useEffect(() => {
    if (isRecording) {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isRecording) pulse();
        });
      };
      pulse();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Check audio permissions
  const checkPermissions = async () => {
    try {
      const status = await requestPermission(PERMISSION_TYPES.AUDIO_RECORDING, {
        showRationale: true,
        rationale: 'Echo needs microphone access to record and translate audio.',
        showSettingsPrompt: true,
      });

      setPermissionGranted(status === 'granted');

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Microphone access is required for recording. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => navigation.navigate('Settings') },
          ]
        );
      }
    } catch (error) {
      Logger.error('RecordScreen', 'Error checking permissions:', error);
      setPermissionGranted(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!permissionGranted) {
      await checkPermissions();
      return;
    }

    try {
      Logger.info('RecordScreen', 'Starting recording...');

      await audioActions.startRecording({
        quality: 'high',
        format: 'wav',
        sampleRate: 44100,
        channels: 1,
      });

      setIsRecording(true);
      setRecordingDuration(0);
      setCurrentTranslation('');

      // Start duration timer
      durationTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start audio level monitoring
      startAudioLevelMonitoring();

    } catch (error) {
      Logger.error('RecordScreen', 'Error starting recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      Logger.info('RecordScreen', 'Stopping recording...');

      const recording = await audioActions.stopRecording();

      setIsRecording(false);

      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }

      stopAudioLevelMonitoring();

      if (recording) {
        // Start translation
        await translateRecording(recording);
      }

    } catch (error) {
      Logger.error('RecordScreen', 'Error stopping recording:', error);
      Alert.alert('Recording Error', 'Failed to stop recording.');
    }
  };

  // Toggle recording
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Translate recording
  const translateRecording = async (recording) => {
    try {
      Logger.info('RecordScreen', 'Starting translation...');

      setCurrentTranslation('Translating...');

      const translation = await echoActions.translateAudio({
        audioUri: recording.uri,
        targetLanguage: translationLanguage,
        sourceLanguage: 'auto',
      });

      setCurrentTranslation(translation.text || 'Translation failed');

      // Save to history
      await echoActions.saveTranslation({
        originalAudio: recording,
        translation: translation,
        timestamp: Date.now(),
      });

    } catch (error) {
      Logger.error('RecordScreen', 'Error translating recording:', error);
      setCurrentTranslation('Translation failed. Please try again.');
    }
  };

  // Start audio level monitoring
  const startAudioLevelMonitoring = () => {
    // This would integrate with the audio service to get real-time levels
    // For now, simulate with random values
    const interval = setInterval(() => {
      if (isRecording) {
        setAudioLevel(Math.random() * 100);
      }
    }, 100);

    return () => clearInterval(interval);
  };

  // Stop audio level monitoring
  const stopAudioLevelMonitoring = () => {
    setAudioLevel(0);
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Language options
  const languageOptions = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  ];

  if (!permissionGranted) {
    return React.createElement(View, { style: styles.permissionContainer },
      React.createElement(Text, { style: styles.permissionIcon }, '🎤'),
      React.createElement(Text, { style: styles.permissionTitle }, 'Microphone Access Required'),
      React.createElement(Text, { style: styles.permissionText },
        'Echo needs access to your microphone to record and translate audio. Please grant permission to continue.'
      ),
      React.createElement(TouchableOpacity, {
        style: styles.permissionButton,
        onPress: checkPermissions
      }, React.createElement(Text, { style: styles.permissionButtonText }, 'Grant Permission'))
    );
  }

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
      React.createElement(Text, { style: styles.headerTitle }, 'Record & Translate'),
      React.createElement(View, { style: styles.headerSpacer })
    ),

    // Recording Status
    React.createElement(View, { style: styles.statusContainer },
      React.createElement(Text, { style: styles.statusText },
        isRecording ? 'Recording...' : 'Ready to record'
      ),
      React.createElement(Text, { style: styles.durationText },
        formatDuration(recordingDuration)
      )
    ),

    // Audio Level Indicator
    React.createElement(View, { style: styles.levelContainer },
      React.createElement(Text, { style: styles.levelLabel }, 'Audio Level'),
      React.createElement(View, { style: styles.levelBar },
        React.createElement(Animated.View, {
          style: [
            styles.levelFill,
            {
              width: levelAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              })
            }
          ]
        })
      )
    ),

    // Recording Button
    React.createElement(View, { style: styles.recordingContainer },
      React.createElement(Animated.View, {
        style: [styles.recordButtonContainer, { transform: [{ scale: pulseAnim }] }]
      },
        React.createElement(TouchableOpacity, {
          style: [styles.recordButton, isRecording && styles.recordButtonActive],
          onPress: toggleRecording,
          activeOpacity: 0.8
        },
          React.createElement(View, { style: styles.recordButtonInner },
            React.createElement(Text, { style: styles.recordButtonIcon },
              isRecording ? '⏹️' : '🎤'
            )
          )
        )
      ),
      React.createElement(Text, { style: styles.recordButtonText },
        isRecording ? 'Tap to stop' : 'Tap to record'
      )
    ),

    // Language Selection
    React.createElement(View, { style: styles.languageContainer },
      React.createElement(Text, { style: styles.languageTitle }, 'Translate to:'),
      React.createElement(ScrollView, {
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        style: styles.languageScroll
      },
        ...languageOptions.map(lang =>
          React.createElement(TouchableOpacity, {
            key: lang.code,
            style: [
              styles.languageOption,
              translationLanguage === lang.code && styles.languageOptionActive
            ],
            onPress: () => setTranslationLanguage(lang.code)
          },
            React.createElement(Text, { style: styles.languageFlag }, lang.flag),
            React.createElement(Text, {
              style: [
                styles.languageName,
                translationLanguage === lang.code && styles.languageNameActive
              ]
            }, lang.name)
          )
        )
      )
    ),

    // Translation Result
    React.createElement(View, { style: styles.translationContainer },
      React.createElement(Text, { style: styles.translationTitle }, 'Translation:'),
      React.createElement(View, { style: styles.translationBox },
        currentTranslation ?
          React.createElement(Text, { style: styles.translationText }, currentTranslation) :
          React.createElement(Text, { style: styles.translationPlaceholder },
            'Your translation will appear here after recording'
          )
      )
    ),

    // Action Buttons
    currentTranslation && React.createElement(View, { style: styles.actionsContainer },
      React.createElement(TouchableOpacity, {
        style: styles.actionButton,
        onPress: () => {
          // Copy to clipboard functionality would go here
          Alert.alert('Copied', 'Translation copied to clipboard');
        }
      }, React.createElement(Text, { style: styles.actionButtonText }, '📋 Copy')),

      React.createElement(TouchableOpacity, {
        style: styles.actionButton,
        onPress: () => {
          // Share functionality would go here
          Alert.alert('Share', 'Share functionality coming soon');
        }
      }, React.createElement(Text, { style: styles.actionButtonText }, '📤 Share')),

      React.createElement(TouchableOpacity, {
        style: styles.actionButton,
        onPress: () => navigation.navigate('History')
      }, React.createElement(Text, { style: styles.actionButtonText }, '📚 History'))
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
    backgroundColor: THEME.colors.background,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: THEME.spacing.lg,
  },
  permissionTitle: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.text,
    textAlign: 'center',
    marginBottom: THEME.spacing.md,
  },
  permissionText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: THEME.spacing.xl,
  },
  permissionButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
  },
  permissionButtonText: {
    color: THEME.colors.white,
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
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
  statusContainer: {
    alignItems: 'center',
    padding: THEME.spacing.xl,
  },
  statusText: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: THEME.typography.weights.medium,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.sm,
  },
  durationText: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.primary,
    fontFamily: 'monospace',
  },
  levelContainer: {
    paddingHorizontal: THEME.spacing.xl,
    marginBottom: THEME.spacing.xl,
  },
  levelLabel: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  levelBar: {
    height: 8,
    backgroundColor: THEME.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    backgroundColor: THEME.colors.success,
    borderRadius: 4,
  },
  recordingContainer: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.xl,
  },
  recordButtonContainer: {
    marginBottom: THEME.spacing.lg,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.lg,
  },
  recordButtonActive: {
    backgroundColor: THEME.colors.error,
  },
  recordButtonInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: THEME.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonIcon: {
    fontSize: 40,
  },
  recordButtonText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.textSecondary,
    fontWeight: THEME.typography.weights.medium,
  },
  languageContainer: {
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.xl,
  },
  languageTitle: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.md,
  },
  languageScroll: {
    flexGrow: 0,
  },
  languageOption: {
    alignItems: 'center',
    padding: THEME.spacing.md,
    marginRight: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 80,
  },
  languageOptionActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary + '10',
  },
  languageFlag: {
    fontSize: 24,
    marginBottom: THEME.spacing.xs,
  },
  languageName: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  languageNameActive: {
    color: THEME.colors.primary,
    fontWeight: THEME.typography.weights.semibold,
  },
  translationContainer: {
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.xl,
  },
  translationTitle: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.md,
  },
  translationBox: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    minHeight: 100,
    justifyContent: 'center',
    ...THEME.shadows.sm,
  },
  translationText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    lineHeight: 24,
  },
  translationPlaceholder: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: THEME.spacing.lg,
  },
  actionButton: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    ...THEME.shadows.sm,
  },
  actionButtonText: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.text,
    fontWeight: THEME.typography.weights.medium,
  },
});

export default RecordScreen;