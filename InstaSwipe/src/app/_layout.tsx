import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import AuthGate from '@/components/auth-gate';
import OnboardingGate from '@/components/onboarding-gate';
import { getAccessToken, logout, API, OwnProfileResponse } from '@/hooks/auth';
import { AuthContext } from '@/context/auth-context';
import { registerForPushNotificationsAsync, registerNotificationTokenAsync } from '@/hooks/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [profileEditorProfile, setProfileEditorProfile] = useState<OwnProfileResponse | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const token = await getAccessToken();
      setIsAuthenticated(!!token);
    }
    checkAuth();
  }, []);

  // Once authenticated, check whether onboarding is required. Transitions back to
  // unauthenticated reset needsOnboarding at their source (onLogout, the 401 handler
  // below) rather than reactively here, so this effect only needs to act when signed in.
  useEffect(() => {
    if (!isAuthenticated) {
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

  // Register for push notifications once the user reaches the main app (fully
  // authenticated and onboarded). This is what triggers the OS permission prompt.
  useEffect(() => {
    if (!isAuthenticated || needsOnboarding !== false) {
      return;
    }
    async function registerPush() {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await registerNotificationTokenAsync(token);
      }
    }
    registerPush();
  }, [isAuthenticated, needsOnboarding]);

  const authContextValue = useMemo(
    () => ({
      onAuthSuccess: () => setIsAuthenticated(true),
      onLogout: async () => {
        await logout();
        setIsAuthenticated(false);
        setNeedsOnboarding(null);
        setProfileEditorProfile(null);
      },
      onEditProfile: (profile: OwnProfileResponse) => setProfileEditorProfile(profile),
    }),
    [],
  );

  // Show nothing while checking auth or onboarding status to avoid flickering
  if (isAuthenticated === null) {
    return null;
  }

  // Still loading onboarding status
  if (isAuthenticated && needsOnboarding === null) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthContext.Provider value={authContextValue}>
        {!isAuthenticated ? (
          // Not authenticated: show login / register
          <AuthGate onAuthSuccess={() => setIsAuthenticated(true)} />
        ) : profileEditorProfile ? (
          <OnboardingGate
            mode="update"
            initialProfile={profileEditorProfile}
            onOnboardSuccess={() => setProfileEditorProfile(null)}
          />
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
