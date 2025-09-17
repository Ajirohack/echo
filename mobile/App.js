import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Providers
import { EchoProvider } from './src/providers/EchoProvider';
import { AudioProvider } from './src/providers/AudioProvider';
import { RTCProvider } from './src/providers/RTCProvider';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import RecordScreen from './src/screens/RecordScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Theme
import { COLORS } from './src/constants/theme';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  return React.createElement(Tab.Navigator, {
    screenOptions: ({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;

        if (route.name === 'Home') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'Record') {
          iconName = focused ? 'mic' : 'mic-outline';
        } else if (route.name === 'History') {
          iconName = focused ? 'time' : 'time-outline';
        } else if (route.name === 'Settings') {
          iconName = focused ? 'settings' : 'settings-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        }

        return React.createElement(Ionicons, {
          name: iconName,
          size: size,
          color: color
        });
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      tabBarStyle: {
        backgroundColor: COLORS.surface,
        borderTopColor: COLORS.border,
        paddingBottom: 5,
        paddingTop: 5,
        height: 60
      },
      headerStyle: {
        backgroundColor: COLORS.surface,
        borderBottomColor: COLORS.border
      },
      headerTintColor: COLORS.text,
      headerTitleStyle: {
        fontWeight: '600'
      }
    })
  }, [
    React.createElement(Tab.Screen, {
      key: 'Home',
      name: 'Home',
      component: HomeScreen,
      options: {
        title: 'Echo Home',
        tabBarLabel: 'Home'
      }
    }),
    React.createElement(Tab.Screen, {
      key: 'Record',
      name: 'Record',
      component: RecordScreen,
      options: {
        title: 'Record & Translate',
        tabBarLabel: 'Record'
      }
    }),
    React.createElement(Tab.Screen, {
      key: 'History',
      name: 'History',
      component: HistoryScreen,
      options: {
        title: 'Translation History',
        tabBarLabel: 'History'
      }
    }),
    React.createElement(Tab.Screen, {
      key: 'Settings',
      name: 'Settings',
      component: SettingsScreen,
      options: {
        title: 'Settings',
        tabBarLabel: 'Settings'
      }
    }),
    React.createElement(Tab.Screen, {
      key: 'Profile',
      name: 'Profile',
      component: ProfileScreen,
      options: {
        title: 'Profile',
        tabBarLabel: 'Profile'
      }
    })
  ]);
}

export default function App() {
  return React.createElement(GestureHandlerRootView, {
    style: { flex: 1 }
  }, [
    React.createElement(SafeAreaProvider, {
      key: 'safe-area'
    }, [
      React.createElement(EchoProvider, {
        key: 'echo-provider'
      }, [
        React.createElement(AudioProvider, {
          key: 'audio-provider'
        }, [
          React.createElement(RTCProvider, {
            key: 'rtc-provider'
          }, [
            React.createElement(NavigationContainer, {
              key: 'navigation',
              theme: {
                dark: false,
                colors: {
                  primary: COLORS.primary,
                  background: COLORS.background,
                  card: COLORS.surface,
                  text: COLORS.text,
                  border: COLORS.border,
                  notification: COLORS.accent
                }
              }
            }, [
              React.createElement(TabNavigator, { key: 'tab-navigator' })
            ])
          ])
        ])
      ])
    ]),
    React.createElement(StatusBar, {
      key: 'status-bar',
      style: 'auto'
    })
  ]);
}