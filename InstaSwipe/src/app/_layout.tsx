import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import AuthGate from '@/components/auth-gate';
import { getAccessToken } from '@/hooks/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const token = await getAccessToken();
      setIsAuthenticated(!!token);
    }
    checkAuth();
  }, []);

  // Show nothing while checking auth to avoid flickering
  if (isAuthenticated === null) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      {isAuthenticated ? (
        // Authenticated: render the full tab navigator
        <AppTabs />
      ) : (
        // Not authenticated: render the auth gate (no navigator — avoids NavigationContainer conflicts)
        <AuthGate onAuthSuccess={() => setIsAuthenticated(true)} />
      )}
    </ThemeProvider>
  );
}
