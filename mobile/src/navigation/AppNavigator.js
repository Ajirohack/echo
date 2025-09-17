/**
 * Echo Mobile App - Main Navigation
 * Handles app-wide navigation structure
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Screens
import HomeScreen from '../screens/HomeScreen';
import TranslationScreen from '../screens/TranslationScreen';
import CallScreen from '../screens/CallScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LanguageSelectionScreen from '../screens/LanguageSelectionScreen';
import AudioSettingsScreen from '../screens/AudioSettingsScreen';
import NetworkSettingsScreen from '../screens/NetworkSettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SplashScreen from '../screens/SplashScreen';

// Constants
import { COLORS, LAYOUT } from '../constants/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator Component
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Translation':
              iconName = 'translate';
              break;
            case 'Call':
              iconName = 'call';
              break;
            case 'History':
              iconName = 'history';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'help';
          }

          return React.createElement(Icon, {
            name: iconName,
            size: size || LAYOUT.iconSize.md,
            color: color,
          });
        },
        tabBarActiveTintColor: COLORS.primary.main,
        tabBarInactiveTintColor: COLORS.text.secondary,
        tabBarStyle: {
          backgroundColor: COLORS.background.secondary,
          borderTopColor: COLORS.border.primary,
          borderTopWidth: 1,
          height: LAYOUT.tabBarHeight,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: COLORS.background.primary,
          borderBottomColor: COLORS.border.primary,
          borderBottomWidth: 1,
        },
        headerTintColor: COLORS.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Echo',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Translation"
        component={TranslationScreen}
        options={{
          title: 'Translate',
          headerTitle: 'Real-Time Translation',
        }}
      />
      <Tab.Screen
        name="Call"
        component={CallScreen}
        options={{
          title: 'Call',
          headerTitle: 'Voice Call',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          headerTitle: 'Translation History',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitle: 'App Settings',
        }}
      />
    </Tab.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background.primary,
          borderBottomColor: COLORS.border.primary,
          borderBottomWidth: 1,
        },
        headerTintColor: COLORS.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        cardStyle: {
          backgroundColor: COLORS.background.primary,
        },
      }}
    >
      {/* Splash Screen */}
      <Stack.Screen
        name="Splash"
        component={SplashScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Onboarding Screen */}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* Main Tab Navigator */}
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{
          headerShown: false,
        }}
      />

      {/* Modal/Overlay Screens */}
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="LanguageSelection"
        component={LanguageSelectionScreen}
        options={{
          title: 'Select Languages',
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="AudioSettings"
        component={AudioSettingsScreen}
        options={{
          title: 'Audio Settings',
        }}
      />

      <Stack.Screen
        name="NetworkSettings"
        component={NetworkSettingsScreen}
        options={{
          title: 'Network Settings',
        }}
      />

      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{
          title: 'About Echo',
        }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;