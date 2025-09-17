/**
 * Echo Mobile App - Home Screen
 * Main dashboard screen with quick actions and recent activity
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useEcho } from '../providers/EchoProvider';
import { useAudio } from '../providers/AudioProvider';
import { useRTC } from '../providers/RTCProvider';
import { THEME } from '../constants/theme';
import Logger from '../utils/Logger';

const { width: screenWidth } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [quickStats, setQuickStats] = useState({
    totalRecordings: 0,
    totalTranslations: 0,
    activeConnections: 0,
    lastActivity: null,
  });

  const { state: echoState, actions: echoActions } = useEcho();
  const { state: audioState } = useAudio();
  const { state: rtcState } = useRTC();

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      // Get quick stats
      const stats = {
        totalRecordings: audioState.recordings?.length || 0,
        totalTranslations: echoState.translationHistory?.length || 0,
        activeConnections: rtcState.connectedPeers?.length || 0,
        lastActivity: echoState.lastActivity || null,
      };

      setQuickStats(stats);
      Logger.debug('HomeScreen', 'Dashboard data loaded:', stats);
    } catch (error) {
      Logger.error('HomeScreen', 'Error loading dashboard data:', error);
    }
  }, [audioState, echoState, rtcState]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboardData();
      await echoActions.refreshAppState();
    } catch (error) {
      Logger.error('HomeScreen', 'Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboardData, echoActions]);

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  // Quick action handlers
  const handleQuickRecord = () => {
    navigation.navigate('Record');
  };

  const handleQuickTranslate = () => {
    navigation.navigate('Translate');
  };

  const handleJoinRoom = () => {
    Alert.alert(
      'Join Room',
      'Enter room code or scan QR code',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enter Code', onPress: () => navigation.navigate('JoinRoom') },
        { text: 'Scan QR', onPress: () => navigation.navigate('QRScanner') },
      ]
    );
  };

  const handleCreateRoom = () => {
    navigation.navigate('CreateRoom');
  };

  const handleViewHistory = () => {
    navigation.navigate('History');
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  // Render quick action button
  const renderQuickAction = (title, subtitle, onPress, icon, color) => {
    return React.createElement(TouchableOpacity, {
      style: [styles.quickActionCard, { borderLeftColor: color }],
      onPress: onPress,
      activeOpacity: 0.7
    }, React.createElement(View, { style: styles.quickActionContent },
      React.createElement(Text, { style: styles.quickActionIcon }, icon),
      React.createElement(View, { style: styles.quickActionText },
        React.createElement(Text, { style: styles.quickActionTitle }, title),
        React.createElement(Text, { style: styles.quickActionSubtitle }, subtitle)
      )
    ));
  };

  // Render stat card
  const renderStatCard = (title, value, subtitle, color) => {
    return React.createElement(View, {
      style: [styles.statCard, { borderTopColor: color }]
    },
      React.createElement(Text, { style: styles.statValue }, value),
      React.createElement(Text, { style: styles.statTitle }, title),
      subtitle && React.createElement(Text, { style: styles.statSubtitle }, subtitle)
    );
  };

  return React.createElement(ScrollView, {
    style: styles.container,
    contentContainerStyle: styles.contentContainer,
    refreshControl: React.createElement(RefreshControl, {
      refreshing: refreshing,
      onRefresh: onRefresh,
      colors: [THEME.colors.primary],
      tintColor: THEME.colors.primary
    })
  },
    // Header
    React.createElement(View, { style: styles.header },
      React.createElement(View, { style: styles.headerContent },
        React.createElement(Text, { style: styles.welcomeText }, 'Welcome back!'),
        React.createElement(Text, { style: styles.appTitle }, 'Echo')
      ),
      React.createElement(TouchableOpacity, {
        style: styles.settingsButton,
        onPress: handleSettings,
        activeOpacity: 0.7
      }, React.createElement(Text, { style: styles.settingsIcon }, '⚙️'))
    ),

    // Quick Stats
    React.createElement(View, { style: styles.statsContainer },
      React.createElement(Text, { style: styles.sectionTitle }, 'Quick Stats'),
      React.createElement(View, { style: styles.statsGrid },
        renderStatCard(
          'Recordings',
          quickStats.totalRecordings,
          'Total saved',
          THEME.colors.primary
        ),
        renderStatCard(
          'Translations',
          quickStats.totalTranslations,
          'Completed',
          THEME.colors.secondary
        ),
        renderStatCard(
          'Connections',
          quickStats.activeConnections,
          'Currently active',
          THEME.colors.success
        ),
        renderStatCard(
          'Last Activity',
          quickStats.lastActivity
            ? new Date(quickStats.lastActivity).toLocaleDateString()
            : 'Never',
          '',
          THEME.colors.info
        )
      )
    ),

    // Quick Actions
    React.createElement(View, { style: styles.actionsContainer },
      React.createElement(Text, { style: styles.sectionTitle }, 'Quick Actions'),
      React.createElement(View, { style: styles.actionsGrid },
        renderQuickAction(
          'Record Audio',
          'Start recording and translating',
          handleQuickRecord,
          '🎤',
          THEME.colors.primary
        ),
        renderQuickAction(
          'Translate Text',
          'Translate text between languages',
          handleQuickTranslate,
          '🌐',
          THEME.colors.secondary
        ),
        renderQuickAction(
          'Join Room',
          'Connect to existing room',
          handleJoinRoom,
          '🚪',
          THEME.colors.info
        ),
        renderQuickAction(
          'Create Room',
          'Start new collaboration room',
          handleCreateRoom,
          '➕',
          THEME.colors.success
        )
      )
    ),

    // Recent Activity
    React.createElement(View, { style: styles.recentContainer },
      React.createElement(View, { style: styles.recentHeader },
        React.createElement(Text, { style: styles.sectionTitle }, 'Recent Activity'),
        React.createElement(TouchableOpacity, {
          onPress: handleViewHistory,
          activeOpacity: 0.7
        }, React.createElement(Text, { style: styles.viewAllText }, 'View All'))
      ),

      echoState.recentActivity && echoState.recentActivity.length > 0 ?
        React.createElement(View, { style: styles.activityList },
          ...echoState.recentActivity.slice(0, 3).map((activity, index) =>
            React.createElement(View, {
              key: index,
              style: styles.activityItem
            },
              React.createElement(View, { style: styles.activityIcon },
                React.createElement(Text, { style: styles.activityEmoji },
                  activity.type === 'recording' ? '🎤' :
                    activity.type === 'translation' ? '🌐' :
                      activity.type === 'connection' ? '🔗' : '📝'
                )
              ),
              React.createElement(View, { style: styles.activityContent },
                React.createElement(Text, { style: styles.activityTitle }, activity.title),
                React.createElement(Text, { style: styles.activityTime },
                  new Date(activity.timestamp).toLocaleTimeString()
                )
              )
            )
          )
        ) :
        React.createElement(View, { style: styles.emptyState },
          React.createElement(Text, { style: styles.emptyStateIcon }, '📱'),
          React.createElement(Text, { style: styles.emptyStateText }, 'No recent activity'),
          React.createElement(Text, { style: styles.emptyStateSubtext },
            'Start recording or translating to see your activity here'
          )
        )
    ),

    // Connection Status
    rtcState.isConnected && React.createElement(View, { style: styles.connectionStatus },
      React.createElement(View, { style: styles.connectionIndicator }),
      React.createElement(Text, { style: styles.connectionText },
        `Connected to ${rtcState.roomId || 'room'}`
      ),
      React.createElement(Text, { style: styles.connectionSubtext },
        `${rtcState.connectedPeers?.length || 0} participants`
      )
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.xl,
    paddingBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerContent: {
    flex: 1,
  },
  welcomeText: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  appTitle: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.primary,
  },
  settingsButton: {
    padding: THEME.spacing.sm,
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.background,
  },
  settingsIcon: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.md,
  },
  statsContainer: {
    padding: THEME.spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (screenWidth - THEME.spacing.lg * 2 - THEME.spacing.md) / 2,
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
    marginBottom: THEME.spacing.md,
    borderTopWidth: 3,
    ...THEME.shadows.sm,
  },
  statValue: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.xs,
  },
  statTitle: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: THEME.typography.weights.medium,
    color: THEME.colors.textSecondary,
  },
  statSubtitle: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
  },
  actionsContainer: {
    padding: THEME.spacing.lg,
    paddingTop: 0,
  },
  actionsGrid: {
    gap: THEME.spacing.md,
  },
  quickActionCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderLeftWidth: 4,
    ...THEME.shadows.sm,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  quickActionIcon: {
    fontSize: 32,
    marginRight: THEME.spacing.md,
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.xs,
  },
  quickActionSubtitle: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
  },
  recentContainer: {
    padding: THEME.spacing.lg,
    paddingTop: 0,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  viewAllText: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.primary,
    fontWeight: THEME.typography.weights.medium,
  },
  activityList: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    ...THEME.shadows.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: THEME.spacing.md,
  },
  activityEmoji: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.medium,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.xs,
  },
  activityTime: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: THEME.spacing.xl,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: THEME.spacing.md,
  },
  emptyStateText: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.medium,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: THEME.spacing.lg,
    marginTop: 0,
    padding: THEME.spacing.md,
    backgroundColor: THEME.colors.success + '20',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.success,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.success,
    marginRight: THEME.spacing.sm,
  },
  connectionText: {
    flex: 1,
    fontSize: THEME.typography.sizes.sm,
    fontWeight: THEME.typography.weights.medium,
    color: THEME.colors.success,
  },
  connectionSubtext: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.success,
  },
});

export default HomeScreen;