import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import AuthGate from '@/components/auth-gate';
import OnboardingGate from '@/components/onboarding-gate';
import { getAccessToken, logout, API } from '@/hooks/auth';
import { AuthContext } from '@/context/auth-context';
import { registerForPushNotificationsAsync, registerNotificationTokenAsync } from '@/hooks/notifications';
import { hasDiscoveryPreferences } from '@/hooks/matches';

type OnboardingStep = 'profile' | 'discovery';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null | undefined>(undefined);

  useEffect(() => {
    async function checkAuth() {
      const token = await getAccessToken();
      setIsAuthenticated(!!token);
    }
    checkAuth();
  }, []);

  // Once authenticated, check whether onboarding is required. Transitions back to
  // unauthenticated reset onboardingStep at their source (onLogout, the 401 handler
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
          if (data.needsOnboarding) {
            setOnboardingStep('profile');
          } else {
            setOnboardingStep(await hasDiscoveryPreferences() ? null : 'discovery');
          }
        } else if (response.status === 401) {
          setIsAuthenticated(false);
          setOnboardingStep(undefined);
        } else {
          // If the status check fails, skip onboarding to avoid blocking the user
          setOnboardingStep(null);
        }
      } catch {
        setOnboardingStep(null);
      }
    }
    checkOnboarding();
  }, [isAuthenticated]);

  // Register for push notifications once the user reaches the main app (fully
  // authenticated and onboarded). This is what triggers the OS permission prompt.
  useEffect(() => {
    if (!isAuthenticated || onboardingStep !== null) {
      return;
    }
    async function registerPush() {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await registerNotificationTokenAsync(token);
      }
    }
    registerPush();
  }, [isAuthenticated, onboardingStep]);

  const authContextValue = useMemo(
    () => ({
      onAuthSuccess: () => setIsAuthenticated(true),
      onLogout: async () => {
        await logout();
        setIsAuthenticated(false);
        setOnboardingStep(undefined);
      },
    }),
    [],
  );

  const isLoading = isAuthenticated === null || (isAuthenticated && onboardingStep === undefined);

  // Once we're past the auth/onboarding checks and about to render real UI, release
  // the native splash screen held by preventAutoHideAsync() above - otherwise it
  // stays on screen forever, since nothing else in the app ever calls hideAsync().
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Show nothing while checking auth or onboarding status to avoid flickering
  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthContext.Provider value={authContextValue}>
        {!isAuthenticated ? (
          // Not authenticated: show login / register
          <AuthGate onAuthSuccess={() => setIsAuthenticated(true)} />
        ) : onboardingStep ? (
          // Authenticated but setup incomplete: finish profile and discovery onboarding.
          <OnboardingGate
            initialStep={onboardingStep}
            onOnboardSuccess={() => setOnboardingStep(null)}
          />
        ) : (
          // Fully set up: render the main tab navigator
          <AppTabs />
        )}
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
