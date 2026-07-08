import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  DiscoveryProfile,
  getDiscovery,
  getDiscoveryPreferences,
  lovePerson,
  passPerson,
  type DiscoveryPreferences,
  type SwipeResult,
} from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';

const PAGE_SIZE = 20;

const toDiscoveryFilters = (preferences: DiscoveryPreferences) => ({
  minAge: preferences.minAge === '' ? undefined : preferences.minAge,
  maxAge: preferences.maxAge === '' ? undefined : preferences.maxAge,
  gender: preferences.gender || undefined,
  country: preferences.country,
  interests: preferences.interests,
  page: 0,
  size: PAGE_SIZE,
});

const formatResultMessage = (result: SwipeResult) => {
  if (result.status === 'MATCHED') {
    return "It's a match!";
  }

  if (result.status === 'LIKED') {
    return 'Liked';
  }

  return 'Passed';
};

export default function MatchScreen() {
  const theme = useTheme();
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadProfiles();
    }, []),
  );

  async function loadProfiles() {
    setLoading(true);
    setError(null);
    setResultMessage(null);

    try {
      const preferences = await getDiscoveryPreferences();
      const result = await getDiscovery(toDiscoveryFilters(preferences));
      setProfiles(result.content);
    } catch (loadError) {
      setProfiles([]);
      setError(loadError instanceof Error ? loadError.message : 'Could not load matches');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(action: 'love' | 'pass') {
    const currentProfile = profiles[0];
    if (!currentProfile || acting) {
      return;
    }

    setActing(true);
    setError(null);
    setResultMessage(null);

    try {
      const result = action === 'love'
        ? await lovePerson(currentProfile.id)
        : await passPerson(currentProfile.id);

      setResultMessage(formatResultMessage(result));
      setProfiles((current) => current.slice(1));
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Could not save your choice');
    } finally {
      setActing(false);
    }
  }

  const currentProfile = profiles[0];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header />
        <View style={styles.content}>
          <View style={styles.header} />

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={theme.text} />
              <ThemedText type="small" themeColor="textSecondary">
                Searching...
              </ThemedText>
            </View>
          ) : currentProfile ? (
            <View style={styles.stage}>
              <View style={[styles.card, { borderColor: theme.tabActiveBorder }]}>
                <Image
                  source={currentProfile.profilePictureUrl ? { uri: currentProfile.profilePictureUrl } : undefined}
                  style={styles.portrait}
                  contentFit="cover"
                  transition={250}
                />
                <View style={styles.profileOverlay}>
                  <ThemedText type="subtitle" style={styles.profileName}>
                    {currentProfile.displayName}, {currentProfile.age}
                  </ThemedText>
                  <ThemedText type="small" style={styles.profileMeta}>
                    {currentProfile.country}
                  </ThemedText>
                  <View style={styles.chips}>
                    {currentProfile.interests?.map((interest) => (
                      <View key={`${currentProfile.id}-${interest}`} style={[styles.chip, { borderColor: theme.tabActiveBorder }]}>
                        <ThemedText type="small">
                          {interest}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              </View>



              <View style={styles.actions}>
                <Pressable
                  onPress={() => handleDecision('pass')}
                  disabled={acting}
                  style={[styles.actionButton, styles.passButton, acting && styles.disabledButton]}
                >
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                    tintColor="#ffffff"
                    size={34}
                  />
                </Pressable>
                <Pressable
                  onPress={() => handleDecision('love')}
                  disabled={acting}
                  style={[styles.actionButton, styles.loveButton, acting && styles.disabledButton]}
                >
                  <SymbolView
                    name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' } as any}
                    tintColor="#ffffff"
                    size={34}
                  />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.centerState}>
              <ThemedText type="smallBold">No profiles found</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                Update your discovery preferences or try again later.
              </ThemedText>
            </View>
          )}

          {!!resultMessage && (
            <ThemedText type="smallBold" style={styles.resultText}>
              {resultMessage}
            </ThemedText>
          )}

          {!!error && (
            <ThemedText type="small" style={styles.errorText}>
              {error}
            </ThemedText>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    marginLeft: Platform.OS === 'web' ? 100 : 0,
  },
  content: {
    flex: 1,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 3 / 4,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  profileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.two,
    backgroundColor: 'rgba(41, 22, 70, 0.65)',
    gap: Spacing.one,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 28,
    lineHeight: 34,
  },
  profileMeta: {
    color: '#ffffff',
  },
  bio: {
    width: '100%',
    maxWidth: 420,
    textAlign: 'center',
  },
  chips: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  chip: {
    backgroundColor: '#2f2338',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passButton: {
    backgroundColor: '#ff3131',
  },
  loveButton: {
    backgroundColor: '#17de60',
  },
  disabledButton: {
    opacity: 0.6,
  },
  resultText: {
    textAlign: 'center',
    color: '#22c55e',
  },
  errorText: {
    textAlign: 'center',
    color: '#ef4444',
  },
});