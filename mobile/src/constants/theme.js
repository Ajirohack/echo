/**
 * Echo Mobile App - Theme Constants
 * Centralized theme configuration for consistent styling
 */

// Color Palette
export const COLORS = {
  // Primary Colors
  primary: {
    main: '#2196F3',
    light: '#64B5F6',
    dark: '#1976D2',
    contrast: '#FFFFFF',
  },
  
  // Secondary Colors
  secondary: {
    main: '#4CAF50',
    light: '#81C784',
    dark: '#388E3C',
    contrast: '#FFFFFF',
  },
  
  // Background Colors
  background: {
    primary: '#1a1a1a',
    secondary: '#2d2d2d',
    tertiary: '#404040',
    card: '#333333',
    modal: 'rgba(0, 0, 0, 0.8)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Surface Colors
  surface: {
    primary: '#333333',
    secondary: '#404040',
    tertiary: '#4d4d4d',
    elevated: '#525252',
  },
  
  // Text Colors
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    inverse: '#000000',
  },
  
  // Status Colors
  status: {
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },
  
  // Border Colors
  border: {
    primary: 'rgba(255, 255, 255, 0.2)',
    secondary: 'rgba(255, 255, 255, 0.1)',
    focus: '#2196F3',
    error: '#F44336',
  },
  
  // Audio/Translation Specific
  audio: {
    recording: '#F44336',
    playing: '#4CAF50',
    paused: '#FF9800',
    muted: '#9E9E9E',
  },
  
  translation: {
    source: '#2196F3',
    target: '#4CAF50',
    processing: '#FF9800',
  },
  
  // Quality Indicators
  quality: {
    excellent: '#4CAF50',
    good: '#8BC34A',
    fair: '#FF9800',
    poor: '#F44336',
  },
};

// Typography
export const TYPOGRAPHY = {
  // Font Families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'Courier New',
  },
  
  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  // Line Heights
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 36,
    xxxl: 48,
  },
  
  // Font Weights
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border Radius
export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 50,
};

// Shadows
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
};

// Animation Durations
export const ANIMATION = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    easeInOut: 'ease-in-out',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
  },
};

// Layout Dimensions
export const LAYOUT = {
  // Header Heights
  headerHeight: 56,
  tabBarHeight: 60,
  
  // Button Heights
  buttonHeight: {
    small: 32,
    medium: 40,
    large: 48,
  },
  
  // Input Heights
  inputHeight: {
    small: 32,
    medium: 40,
    large: 48,
  },
  
  // Icon Sizes
  iconSize: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
  },
  
  // Avatar Sizes
  avatarSize: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  },
};

// Navigation Theme
export const THEME = {
  navigation: {
    dark: true,
    colors: {
      primary: COLORS.primary.main,
      background: COLORS.background.primary,
      card: COLORS.surface.primary,
      text: COLORS.text.primary,
      border: COLORS.border.primary,
      notification: COLORS.status.error,
    },
  },
};

// Component Specific Themes
export const COMPONENT_THEMES = {
  // Button Themes
  button: {
    primary: {
      backgroundColor: COLORS.primary.main,
      color: COLORS.primary.contrast,
      borderColor: COLORS.primary.main,
    },
    secondary: {
      backgroundColor: COLORS.secondary.main,
      color: COLORS.secondary.contrast,
      borderColor: COLORS.secondary.main,
    },
    outline: {
      backgroundColor: 'transparent',
      color: COLORS.primary.main,
      borderColor: COLORS.primary.main,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: COLORS.text.primary,
      borderColor: 'transparent',
    },
  },
  
  // Input Themes
  input: {
    default: {
      backgroundColor: COLORS.surface.primary,
      borderColor: COLORS.border.primary,
      color: COLORS.text.primary,
      placeholderColor: COLORS.text.tertiary,
    },
    focused: {
      borderColor: COLORS.border.focus,
    },
    error: {
      borderColor: COLORS.border.error,
    },
  },
  
  // Card Themes
  card: {
    default: {
      backgroundColor: COLORS.background.card,
      borderColor: COLORS.border.secondary,
    },
    elevated: {
      backgroundColor: COLORS.surface.elevated,
      ...SHADOWS.medium,
    },
  },
};

// Responsive Breakpoints
export const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};

// Z-Index Levels
export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
  toast: 1070,
};

export default {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  ANIMATION,
  LAYOUT,
  THEME,
  COMPONENT_THEMES,
  BREAKPOINTS,
  Z_INDEX,
};