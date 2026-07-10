/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0f0913',
    background: '#fff6fa',
    backgroundElement: '#ae89c4',
    backgroundSelected: '#f3e3ff',
    textSecondary: '#656b78',
    iconMuted: '#8a7698',
    tabActiveBackground: '#ffffff',
    tabActiveBorder: '#c2accf',
  },
  dark: {
    text: '#b6a9cac9',
    background: '#0f0913',
    backgroundElement: '#6249cabe',
    backgroundSelected: '#2f2338',
    tint: '#ffffff',
    icon: '#ffffff',
    textSecondary: '#9d92adc9',
    iconMuted: '#a892bf',
    tabActiveBackground: '#000000',
    tabActiveBorder: '#43344e',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const tabBarColors = {
  light: {
    background: Colors.light.background,
    indicator: Colors.light.backgroundElement,
    labelSelected: Colors.light.text,
  },
  dark: {
    background: Colors.dark.background,
    indicator: Colors.dark.backgroundElement,
    labelSelected: Colors.dark.text,
  },
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
