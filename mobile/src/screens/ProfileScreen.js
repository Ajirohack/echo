/**
 * Echo Mobile App - Profile Screen
 * User profile and account management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useEcho } from '../providers/EchoProvider';
import { THEME } from '../constants/theme';
import Logger from '../utils/Logger';
import { StorageManager } from '../utils/storage';

const ProfileScreen = ({ navigation }) => {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    preferredLanguages: ['en', 'es'],
    avatar: null,
    joinDate: Date.now(),
    totalTranslations: 0,
    totalRecordings: 0,
    favoriteLanguages: [],
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [stats, setStats] = useState({
    thisWeek: 0,
    thisMonth: 0,
    totalTime: 0,
    streak: 0,
  });

  const { state: echoState, actions: echoActions } = useEcho();

  // Load profile on mount
  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  // Load user profile
  const loadProfile = async () => {
    try {
      const savedProfile = await StorageManager.getItem('userProfile');
      if (savedProfile) {
        setProfile({ ...profile, ...savedProfile });
        setEditedProfile({ ...profile, ...savedProfile });
      } else {
        // Set default profile for new users
        const defaultProfile = {
          ...profile,
          name: 'Echo User',
          joinDate: Date.now(),
        };
        setProfile(defaultProfile);
        setEditedProfile(defaultProfile);
        await StorageManager.setItem('userProfile', defaultProfile);
      }
    } catch (error) {
      Logger.error('ProfileScreen', 'Error loading profile:', error);
    }
  };

  // Load user statistics
  const loadStats = async () => {
    try {
      const history = await echoActions.getTranslationHistory();
      const recordings = await echoActions.getRecordings?.() || [];

      if (history) {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const thisWeek = history.filter(item =>
          new Date(item.timestamp) > oneWeekAgo
        ).length;

        const thisMonth = history.filter(item =>
          new Date(item.timestamp) > oneMonthAgo
        ).length;

        // Calculate total time (simplified)
        const totalTime = history.length * 2; // Assume 2 minutes per translation

        // Calculate streak (simplified)
        const streak = calculateStreak(history);

        setStats({
          thisWeek,
          thisMonth,
          totalTime,
          streak,
        });

        // Update profile with current stats
        const updatedProfile = {
          ...profile,
          totalTranslations: history.length,
          totalRecordings: recordings.length,
        };
        setProfile(updatedProfile);
      }
    } catch (error) {
      Logger.error('ProfileScreen', 'Error loading stats:', error);
    }
  };

  // Calculate usage streak
  const calculateStreak = (history) => {
    if (!history || history.length === 0) return 0;

    const sortedHistory = history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let currentDate = new Date(today);

    for (let i = 0; i < sortedHistory.length; i++) {
      const itemDate = new Date(sortedHistory[i].timestamp);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (itemDate.getTime() < currentDate.getTime()) {
        break;
      }
    }

    return streak;
  };

  // Save profile
  const saveProfile = async () => {
    try {
      await StorageManager.setItem('userProfile', editedProfile);
      setProfile(editedProfile);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Logger.error('ProfileScreen', 'Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditedProfile({ ...profile });
    setIsEditing(false);
  };

  // Add preferred language
  const addPreferredLanguage = (languageCode) => {
    const languages = editedProfile.preferredLanguages || [];
    if (!languages.includes(languageCode)) {
      setEditedProfile({
        ...editedProfile,
        preferredLanguages: [...languages, languageCode]
      });
    }
  };

  // Remove preferred language
  const removePreferredLanguage = (languageCode) => {
    const languages = editedProfile.preferredLanguages || [];
    setEditedProfile({
      ...editedProfile,
      preferredLanguages: languages.filter(lang => lang !== languageCode)
    });
  };

  // Format date
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format time duration
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Language options
  const languageOptions = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  ];

  // Get language info
  const getLanguageInfo = (code) => {
    return languageOptions.find(lang => lang.code === code) ||
      { code, name: code.toUpperCase(), flag: '🌐' };
  };

  // Render stat card
  const renderStatCard = (title, value, subtitle, icon) => {
    return React.createElement(View, { style: styles.statCard },
      React.createElement(Text, { style: styles.statIcon }, icon),
      React.createElement(Text, { style: styles.statValue }, value.toString()),
      React.createElement(Text, { style: styles.statTitle }, title),
      subtitle && React.createElement(Text, { style: styles.statSubtitle }, subtitle)
    );
  };

  // Render language chip
  const renderLanguageChip = (languageCode, canRemove = false) => {
    const langInfo = getLanguageInfo(languageCode);

    return React.createElement(View, {
      key: languageCode,
      style: styles.languageChip
    },
      React.createElement(Text, { style: styles.languageFlag }, langInfo.flag),
      React.createElement(Text, { style: styles.languageName }, langInfo.name),
      canRemove && React.createElement(TouchableOpacity, {
        style: styles.removeLanguageButton,
        onPress: () => removePreferredLanguage(languageCode)
      }, React.createElement(Text, { style: styles.removeLanguageText }, '×'))
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
      React.createElement(Text, { style: styles.headerTitle }, 'Profile'),
      React.createElement(TouchableOpacity, {
        style: styles.editButton,
        onPress: () => isEditing ? saveProfile() : setIsEditing(true)
      }, React.createElement(Text, { style: styles.editButtonText },
        isEditing ? 'Save' : 'Edit'
      ))
    ),

    // Profile Info
    React.createElement(View, { style: styles.profileSection },
      React.createElement(View, { style: styles.avatarContainer },
        profile.avatar ?
          React.createElement(Image, {
            source: { uri: profile.avatar },
            style: styles.avatar
          }) :
          React.createElement(View, { style: styles.avatarPlaceholder },
            React.createElement(Text, { style: styles.avatarText },
              (profile.name || 'U').charAt(0).toUpperCase()
            )
          ),
        isEditing && React.createElement(TouchableOpacity, {
          style: styles.changeAvatarButton,
          onPress: () => Alert.alert('Change Avatar', 'Avatar change coming soon')
        }, React.createElement(Text, { style: styles.changeAvatarText }, '📷'))
      ),

      React.createElement(View, { style: styles.profileInfo },
        isEditing ?
          React.createElement(TextInput, {
            style: styles.nameInput,
            value: editedProfile.name || '',
            onChangeText: (text) => setEditedProfile({ ...editedProfile, name: text }),
            placeholder: 'Enter your name',
            placeholderTextColor: THEME.colors.textSecondary
          }) :
          React.createElement(Text, { style: styles.profileName }, profile.name || 'Echo User'),

        isEditing ?
          React.createElement(TextInput, {
            style: styles.emailInput,
            value: editedProfile.email || '',
            onChangeText: (text) => setEditedProfile({ ...editedProfile, email: text }),
            placeholder: 'Enter your email',
            placeholderTextColor: THEME.colors.textSecondary,
            keyboardType: 'email-address',
            autoCapitalize: 'none'
          }) :
          React.createElement(Text, { style: styles.profileEmail },
            profile.email || 'No email set'
          ),

        React.createElement(Text, { style: styles.joinDate },
          `Member since ${formatDate(profile.joinDate)}`
        )
      )
    ),

    // Statistics
    React.createElement(View, { style: styles.statsSection },
      React.createElement(Text, { style: styles.sectionTitle }, 'Statistics'),
      React.createElement(View, { style: styles.statsGrid },
        renderStatCard('Translations', profile.totalTranslations, 'Total', '🔄'),
        renderStatCard('This Week', stats.thisWeek, 'Translations', '📅'),
        renderStatCard('This Month', stats.thisMonth, 'Translations', '📊'),
        renderStatCard('Streak', stats.streak, 'Days', '🔥')
      ),
      React.createElement(View, { style: styles.additionalStats },
        React.createElement(View, { style: styles.statRow },
          React.createElement(Text, { style: styles.statLabel }, 'Total Time'),
          React.createElement(Text, { style: styles.statValue }, formatDuration(stats.totalTime))
        ),
        React.createElement(View, { style: styles.statRow },
          React.createElement(Text, { style: styles.statLabel }, 'Recordings'),
          React.createElement(Text, { style: styles.statValue }, profile.totalRecordings.toString())
        )
      )
    ),

    // Preferred Languages
    React.createElement(View, { style: styles.languagesSection },
      React.createElement(Text, { style: styles.sectionTitle }, 'Preferred Languages'),
      React.createElement(View, { style: styles.languagesList },
        ...(editedProfile.preferredLanguages || profile.preferredLanguages || []).map(lang =>
          renderLanguageChip(lang, isEditing)
        )
      ),

      isEditing && React.createElement(View, { style: styles.addLanguageSection },
        React.createElement(Text, { style: styles.addLanguageTitle }, 'Add Language:'),
        React.createElement(ScrollView, {
          horizontal: true,
          showsHorizontalScrollIndicator: false,
          style: styles.availableLanguages
        },
          ...languageOptions
            .filter(lang => !(editedProfile.preferredLanguages || []).includes(lang.code))
            .map(lang =>
              React.createElement(TouchableOpacity, {
                key: lang.code,
                style: styles.availableLanguageChip,
                onPress: () => addPreferredLanguage(lang.code)
              },
                React.createElement(Text, { style: styles.languageFlag }, lang.flag),
                React.createElement(Text, { style: styles.availableLanguageName }, lang.name)
              )
            )
        )
      )
    ),

    // Actions
    React.createElement(View, { style: styles.actionsSection },
      React.createElement(TouchableOpacity, {
        style: styles.actionButton,
        onPress: () => navigation.navigate('History')
      }, React.createElement(Text, { style: styles.actionButtonText }, '📚 View History')),

      React.createElement(TouchableOpacity, {
        style: styles.actionButton,
        onPress: () => navigation.navigate('Settings')
      }, React.createElement(Text, { style: styles.actionButtonText }, '⚙️ Settings')),

      React.createElement(TouchableOpacity, {
        style: [styles.actionButton, styles.secondaryButton],
        onPress: () => Alert.alert('Export Data', 'Export functionality coming soon')
      }, React.createElement(Text, { style: [styles.actionButtonText, styles.secondaryButtonText] }, '📤 Export Data'))
    ),

    // Edit Actions
    isEditing && React.createElement(View, { style: styles.editActions },
      React.createElement(TouchableOpacity, {
        style: [styles.editActionButton, styles.cancelButton],
        onPress: cancelEditing
      }, React.createElement(Text, { style: styles.cancelButtonText }, 'Cancel')),

      React.createElement(TouchableOpacity, {
        style: [styles.editActionButton, styles.saveButton],
        onPress: saveProfile
      }, React.createElement(Text, { style: styles.saveButtonText }, 'Save Changes'))
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
  editButton: {
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
  },
  editButtonText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.primary,
    fontWeight: THEME.typography.weights.semibold,
  },
  profileSection: {
    backgroundColor: THEME.colors.surface,
    paddingVertical: THEME.spacing.xl,
    alignItems: 'center',
    marginTop: THEME.spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: THEME.spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.white,
  },
  changeAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: THEME.colors.surface,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.sm,
  },
  changeAvatarText: {
    fontSize: 16,
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.xs,
  },
  nameInput: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.text,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingVertical: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    minWidth: 200,
  },
  profileEmail: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  emailInput: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingVertical: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    minWidth: 200,
  },
  joinDate: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
  },
  statsSection: {
    backgroundColor: THEME.colors.surface,
    marginTop: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    paddingHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: THEME.spacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    marginRight: '2%',
    ...THEME.shadows.sm,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: THEME.spacing.sm,
  },
  statValue: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.primary,
    marginBottom: THEME.spacing.xs,
  },
  statTitle: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  statSubtitle: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  additionalStats: {
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  statLabel: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
  },
  languagesSection: {
    backgroundColor: THEME.colors.surface,
    marginTop: THEME.spacing.lg,
    paddingVertical: THEME.spacing.lg,
  },
  languagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: THEME.spacing.lg,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary + '20',
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    marginRight: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  languageFlag: {
    fontSize: 16,
    marginRight: THEME.spacing.xs,
  },
  languageName: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.primary,
    fontWeight: THEME.typography.weights.medium,
  },
  removeLanguageButton: {
    marginLeft: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.xs,
  },
  removeLanguageText: {
    fontSize: 16,
    color: THEME.colors.error,
    fontWeight: THEME.typography.weights.bold,
  },
  addLanguageSection: {
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.md,
  },
  addLanguageTitle: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.sm,
  },
  availableLanguages: {
    flexGrow: 0,
  },
  availableLanguageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    marginRight: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  availableLanguageName: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.text,
  },
  actionsSection: {
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  actionButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.lg,
    paddingVertical: THEME.spacing.md,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  actionButtonText: {
    color: THEME.colors.white,
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
  },
  secondaryButton: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  secondaryButtonText: {
    color: THEME.colors.text,
  },
  editActions: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.lg,
    marginTop: THEME.spacing.lg,
  },
  editActionButton: {
    flex: 1,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
    alignItems: 'center',
    marginHorizontal: THEME.spacing.xs,
  },
  cancelButton: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cancelButtonText: {
    color: THEME.colors.text,
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
  },
  saveButton: {
    backgroundColor: THEME.colors.primary,
  },
  saveButtonText: {
    color: THEME.colors.white,
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
  },
});

export default ProfileScreen;