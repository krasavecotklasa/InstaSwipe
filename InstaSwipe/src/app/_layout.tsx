import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import AuthGate from '@/components/auth-gate';
import OnboardingGate from '@/components/onboarding-gate';
import { getAccessToken, logout, API } from '@/hooks/auth';
import { AuthContext } from '@/hooks/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const token = await getAccessToken();
      setIsAuthenticated(!!token);
    }
    checkAuth();
  }, []);

  // Once authenticated, check whether onboarding is required
  useEffect(() => {
    if (!isAuthenticated) {
      setNeedsOnboarding(null);
      return;
    }
    async function checkOnboarding() {
      try {
        const response = await API.getProfileStatus();
        if (response.ok) {
          const data = await response.json();
          setNeedsOnboarding(!!data.needsOnboarding);
        } else if (response.status === 401) {
          setIsAuthenticated(false);
          setNeedsOnboarding(null);
        } else {
          // If the status check fails, skip onboarding to avoid blocking the user
          setNeedsOnboarding(false);
        }
      } catch {
        setNeedsOnboarding(false);
      }
    }
    checkOnboarding();
  }, [isAuthenticated]);

  // Show nothing while checking auth or onboarding status to avoid flickering
  if (isAuthenticated === null) {
    return null;
  }

  // Still loading onboarding status
  if (isAuthenticated && needsOnboarding === null) {
    return null;
  }

  const authContextValue = useMemo(
    () => ({
      onAuthSuccess: () => setIsAuthenticated(true),
      onLogout: async () => {
        await logout();
        setIsAuthenticated(false);
        setNeedsOnboarding(null);
      },
    }),
    [],
  );

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthContext.Provider value={authContextValue}>
        <AnimatedSplashOverlay />

        {!isAuthenticated ? (
          // Not authenticated: show login / register
          <AuthGate onAuthSuccess={() => setIsAuthenticated(true)} />
        ) : needsOnboarding ? (
          // Authenticated but profile incomplete: show onboarding
          <OnboardingGate onOnboardSuccess={() => setNeedsOnboarding(false)} />
        ) : (
          // Fully set up: render the main tab navigator
          <AppTabs />
        )}
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
