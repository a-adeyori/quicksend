import { Platform } from 'react-native';

export const colors = {
  // Brand
  primary: '#2d9e6b',
  primaryDark: '#1e7a50',
  primaryLight: '#e6f7f0',
  primaryMid: '#4ab882',

  // Surface
  background: '#f4faf7',
  card: '#ffffff',
  cardBorder: '#e8f3ee',
  inputBg: '#f0f8f4',

  // Text
  textPrimary: '#1a2e24',
  textSecondary: '#6b8c7a',
  textMuted: '#9ab5a6',
  textOnPrimary: '#ffffff',

  // Semantic
  moneyIn: '#1d8a58',
  moneyOut: '#e05a4b',
  pending: '#e8a040',
  completed: '#2d9e6b',
  failed: '#e05a4b',

  // Neutrals
  border: '#dceee6',
  divider: '#eef6f1',
  shadow: 'rgba(29, 70, 48, 0.10)',
  overlay: 'rgba(0, 0, 0, 0.45)',

  // Status
  success: '#2d9e6b',
  warning: '#e8a040',
  error: '#e05a4b',
  info: '#3b82f6',

  // Dark mode
  dark: {
    background: '#0f1f17',
    card: '#1a2e24',
    textPrimary: '#e8f5ee',
    textSecondary: '#7aab8f',
    border: '#2a4a36',
    inputBg: '#1f3828',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),

  // Size scale
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 36,

  // Weight
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  bottom: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 10,
  },
};

/** Merge into TextInput `style` — removes the default harsh web focus outline (“black box”). */
export const textInputWeb: Record<string, unknown> =
  Platform.OS === 'web'
    ? ({ outlineWidth: 0, outlineStyle: 'none', outlineColor: 'transparent' } as Record<string, unknown>)
    : {};
