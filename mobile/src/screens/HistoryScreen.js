/**
 * Echo Mobile App - History Screen
 * Display and manage translation history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useEcho } from '../providers/EchoProvider';
import { useAudio } from '../providers/AudioProvider';
import { THEME } from '../constants/theme';
import Logger from '../utils/Logger';

const HistoryScreen = ({ navigation }) => {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { state: echoState, actions: echoActions } = useEcho();
  const { actions: audioActions } = useAudio();

  // Load history on screen focus
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  // Filter and search history when dependencies change
  useEffect(() => {
    filterAndSearchHistory();
  }, [history, searchQuery, sortOrder, filterLanguage]);

  // Load translation history
  const loadHistory = async () => {
    try {
      setIsLoading(true);
      Logger.info('HistoryScreen', 'Loading translation history...');

      const historyData = await echoActions.getTranslationHistory();
      setHistory(historyData || []);

    } catch (error) {
      Logger.error('HistoryScreen', 'Error loading history:', error);
      Alert.alert('Error', 'Failed to load translation history');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh history
  const refreshHistory = async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  };

  // Filter and search history
  const filterAndSearchHistory = () => {
    let filtered = [...history];

    // Apply language filter
    if (filterLanguage !== 'all') {
      filtered = filtered.filter(item =>
        item.translation?.targetLanguage === filterLanguage
      );
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.translation?.text?.toLowerCase().includes(query) ||
        item.translation?.originalText?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    setFilteredHistory(filtered);
  };

  // Delete history item
  const deleteHistoryItem = async (itemId) => {
    Alert.alert(
      'Delete Translation',
      'Are you sure you want to delete this translation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await echoActions.deleteTranslation(itemId);
              await loadHistory();
            } catch (error) {
              Logger.error('HistoryScreen', 'Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete translation');
            }
          }
        }
      ]
    );
  };

  // Play audio recording
  const playAudio = async (audioUri) => {
    try {
      Logger.info('HistoryScreen', 'Playing audio:', audioUri);
      await audioActions.playAudio(audioUri);
    } catch (error) {
      Logger.error('HistoryScreen', 'Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  // Share translation
  const shareTranslation = (item) => {
    // Share functionality would be implemented here
    Alert.alert('Share', 'Share functionality coming soon');
  };

  // Copy translation to clipboard
  const copyToClipboard = (text) => {
    // Clipboard functionality would be implemented here
    Alert.alert('Copied', 'Translation copied to clipboard');
  };

  // Show item details
  const showItemDetails = (item) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  // Format date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get language flag
  const getLanguageFlag = (languageCode) => {
    const flags = {
      'es': '🇪🇸',
      'fr': '🇫🇷',
      'de': '🇩🇪',
      'it': '🇮🇹',
      'pt': '🇵🇹',
      'zh': '🇨🇳',
      'ja': '🇯🇵',
      'ko': '🇰🇷',
      'en': '🇺🇸',
    };
    return flags[languageCode] || '🌐';
  };

  // Render history item
  const renderHistoryItem = ({ item }) => {
    const translation = item.translation || {};
    const hasAudio = item.originalAudio?.uri;

    return React.createElement(TouchableOpacity, {
      style: styles.historyItem,
      onPress: () => showItemDetails(item),
      activeOpacity: 0.7
    },
      React.createElement(View, { style: styles.itemHeader },
        React.createElement(View, { style: styles.itemInfo },
          React.createElement(Text, { style: styles.itemLanguage },
            getLanguageFlag(translation.targetLanguage),
            ' ',
            translation.targetLanguage?.toUpperCase() || 'Unknown'
          ),
          React.createElement(Text, { style: styles.itemDate },
            formatDate(item.timestamp)
          )
        ),
        React.createElement(View, { style: styles.itemActions },
          hasAudio && React.createElement(TouchableOpacity, {
            style: styles.actionButton,
            onPress: () => playAudio(item.originalAudio.uri)
          }, React.createElement(Text, { style: styles.actionIcon }, '▶️')),

          React.createElement(TouchableOpacity, {
            style: styles.actionButton,
            onPress: () => copyToClipboard(translation.text)
          }, React.createElement(Text, { style: styles.actionIcon }, '📋')),

          React.createElement(TouchableOpacity, {
            style: styles.actionButton,
            onPress: () => deleteHistoryItem(item.id)
          }, React.createElement(Text, { style: styles.actionIcon }, '🗑️'))
        )
      ),

      React.createElement(Text, {
        style: styles.itemText,
        numberOfLines: 2
      }, translation.text || 'No translation available'),

      translation.originalText && React.createElement(Text, {
        style: styles.itemOriginal,
        numberOfLines: 1
      }, `Original: ${translation.originalText}`)
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    return React.createElement(View, { style: styles.emptyContainer },
      React.createElement(Text, { style: styles.emptyIcon }, '📚'),
      React.createElement(Text, { style: styles.emptyTitle }, 'No Translations Yet'),
      React.createElement(Text, { style: styles.emptyText },
        'Start recording and translating to see your history here'
      ),
      React.createElement(TouchableOpacity, {
        style: styles.emptyButton,
        onPress: () => navigation.navigate('Record')
      }, React.createElement(Text, { style: styles.emptyButtonText }, 'Start Recording'))
    );
  };

  // Render details modal
  const renderDetailsModal = () => {
    if (!selectedItem) return null;

    const translation = selectedItem.translation || {};
    const hasAudio = selectedItem.originalAudio?.uri;

    return React.createElement(Modal, {
      visible: showDetailsModal,
      animationType: 'slide',
      presentationStyle: 'pageSheet'
    },
      React.createElement(View, { style: styles.modalContainer },
        React.createElement(View, { style: styles.modalHeader },
          React.createElement(TouchableOpacity, {
            onPress: () => setShowDetailsModal(false)
          }, React.createElement(Text, { style: styles.modalCloseButton }, '✕')),
          React.createElement(Text, { style: styles.modalTitle }, 'Translation Details'),
          React.createElement(View, { style: styles.modalSpacer })
        ),

        React.createElement(View, { style: styles.modalContent },
          React.createElement(View, { style: styles.detailSection },
            React.createElement(Text, { style: styles.detailLabel }, 'Language'),
            React.createElement(Text, { style: styles.detailValue },
              getLanguageFlag(translation.targetLanguage),
              ' ',
              translation.targetLanguage?.toUpperCase() || 'Unknown'
            )
          ),

          React.createElement(View, { style: styles.detailSection },
            React.createElement(Text, { style: styles.detailLabel }, 'Date & Time'),
            React.createElement(Text, { style: styles.detailValue },
              new Date(selectedItem.timestamp).toLocaleString()
            )
          ),

          translation.originalText && React.createElement(View, { style: styles.detailSection },
            React.createElement(Text, { style: styles.detailLabel }, 'Original Text'),
            React.createElement(Text, { style: styles.detailText },
              translation.originalText
            )
          ),

          React.createElement(View, { style: styles.detailSection },
            React.createElement(Text, { style: styles.detailLabel }, 'Translation'),
            React.createElement(Text, { style: styles.detailText },
              translation.text || 'No translation available'
            )
          ),

          hasAudio && React.createElement(View, { style: styles.detailSection },
            React.createElement(Text, { style: styles.detailLabel }, 'Audio Recording'),
            React.createElement(TouchableOpacity, {
              style: styles.playButton,
              onPress: () => playAudio(selectedItem.originalAudio.uri)
            }, React.createElement(Text, { style: styles.playButtonText }, '▶️ Play Recording'))
          ),

          React.createElement(View, { style: styles.modalActions },
            React.createElement(TouchableOpacity, {
              style: styles.modalActionButton,
              onPress: () => copyToClipboard(translation.text)
            }, React.createElement(Text, { style: styles.modalActionText }, '📋 Copy')),

            React.createElement(TouchableOpacity, {
              style: styles.modalActionButton,
              onPress: () => shareTranslation(selectedItem)
            }, React.createElement(Text, { style: styles.modalActionText }, '📤 Share'))
          )
        )
      )
    );
  };

  return React.createElement(View, { style: styles.container },
    // Header
    React.createElement(View, { style: styles.header },
      React.createElement(TouchableOpacity, {
        style: styles.backButton,
        onPress: () => navigation.goBack()
      }, React.createElement(Text, { style: styles.backIcon }, '←')),
      React.createElement(Text, { style: styles.headerTitle }, 'Translation History'),
      React.createElement(TouchableOpacity, {
        style: styles.sortButton,
        onPress: () => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')
      }, React.createElement(Text, { style: styles.sortIcon },
        sortOrder === 'newest' ? '↓' : '↑'
      ))
    ),

    // Search and filters
    React.createElement(View, { style: styles.searchContainer },
      React.createElement(TextInput, {
        style: styles.searchInput,
        placeholder: 'Search translations...',
        placeholderTextColor: THEME.colors.textSecondary,
        value: searchQuery,
        onChangeText: setSearchQuery,
        clearButtonMode: 'while-editing'
      })
    ),

    // History list
    React.createElement(FlatList, {
      data: filteredHistory,
      renderItem: renderHistoryItem,
      keyExtractor: (item) => item.id?.toString() || Math.random().toString(),
      contentContainerStyle: styles.listContainer,
      refreshControl: React.createElement(RefreshControl, {
        refreshing: isRefreshing,
        onRefresh: refreshHistory,
        tintColor: THEME.colors.primary
      }),
      ListEmptyComponent: renderEmptyState,
      showsVerticalScrollIndicator: false
    }),

    // Details modal
    renderDetailsModal()
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
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
  sortButton: {
    padding: THEME.spacing.sm,
  },
  sortIcon: {
    fontSize: 20,
    color: THEME.colors.primary,
  },
  searchContainer: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
  },
  searchInput: {
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  listContainer: {
    padding: THEME.spacing.lg,
  },
  historyItem: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemLanguage: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.primary,
    marginBottom: 2,
  },
  itemDate: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textSecondary,
  },
  itemActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: THEME.spacing.xs,
    marginLeft: THEME.spacing.xs,
  },
  actionIcon: {
    fontSize: 16,
  },
  itemText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    lineHeight: 20,
    marginBottom: THEME.spacing.xs,
  },
  itemOriginal: {
    fontSize: THEME.typography.sizes.sm,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: THEME.spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: THEME.spacing.lg,
  },
  emptyTitle: {
    fontSize: THEME.typography.sizes.xl,
    fontWeight: THEME.typography.weights.bold,
    color: THEME.colors.text,
    marginBottom: THEME.spacing.sm,
  },
  emptyText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: THEME.spacing.xl,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.lg,
  },
  emptyButtonText: {
    color: THEME.colors.white,
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.xl,
    paddingBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  modalCloseButton: {
    fontSize: 20,
    color: THEME.colors.textSecondary,
    padding: THEME.spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontSize: THEME.typography.sizes.lg,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  modalSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: THEME.spacing.lg,
  },
  detailSection: {
    marginBottom: THEME.spacing.lg,
  },
  detailLabel: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: THEME.typography.weights.semibold,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  detailValue: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
  },
  detailText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    lineHeight: 22,
    backgroundColor: THEME.colors.surface,
    padding: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
  },
  playButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    color: THEME.colors.white,
    fontSize: THEME.typography.sizes.md,
    fontWeight: THEME.typography.weights.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: THEME.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  modalActionButton: {
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    ...THEME.shadows.sm,
  },
  modalActionText: {
    fontSize: THEME.typography.sizes.md,
    color: THEME.colors.text,
    fontWeight: THEME.typography.weights.medium,
  },
});

export default HistoryScreen;