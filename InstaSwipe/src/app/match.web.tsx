import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import DiscoveryProfileModal from '@/components/discovery-profile-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { type DiscoveryProfile, useDiscoverySwipe } from '@/hooks/matches';
import { MAX_VISIBLE_MATCH_INTERESTS } from '@/constants/interests';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function MatchScreen() {
  const theme = useTheme();
  const { isMobileWeb, isDesktopWeb } = useResponsiveLayout();
  const {
    currentProfile,
    loading,
    acting,
    error,
    resultMessage,
    handleDecision,
  } = useDiscoverySwipe();
  const [profileModalProfile, setProfileModalProfile] = useState<DiscoveryProfile | null>(null);

  const openProfileModal = () => {
    if (!currentProfile) {
      return;
    }

    setProfileModalProfile(currentProfile);
  };

  const closeProfileModal = () => {
    setProfileModalProfile(null);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { marginLeft: isDesktopWeb ? 100 : 0 }]} edges={['top', 'left', 'right']}>
        <Header />
        <View style={[styles.content, isMobileWeb && styles.mobileContent]}>
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
              <View style={[styles.card, isMobileWeb && styles.mobileCard, { borderColor: theme.tabActiveBorder }]}>
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
                    {currentProfile.interests?.slice(0, MAX_VISIBLE_MATCH_INTERESTS).map((interest) => (
                      <View key={`${currentProfile.id}-${interest}`} style={[styles.chip, { backgroundColor: theme.backgroundSelected, borderColor: theme.tabActiveBorder }]}>
                        <ThemedText type="small">
                          {interest}
                        </ThemedText>
                      </View>
                    ))}
                    {(currentProfile.interests?.length ?? 0) > MAX_VISIBLE_MATCH_INTERESTS && (
                      <View style={[styles.chip, { backgroundColor: theme.backgroundSelected, borderColor: theme.tabActiveBorder }]}>
                        <ThemedText type="small">
                          +{(currentProfile.interests?.length ?? 0) - MAX_VISIBLE_MATCH_INTERESTS}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Pass button */}
              <View style={[styles.actions, isMobileWeb && styles.mobileActions]}>
                <Pressable
                  onPress={() => handleDecision('pass')}
                  disabled={acting}
                  style={[styles.actionButton, isMobileWeb && styles.mobileActionButton, styles.passButton, acting && styles.disabledButton]}
                >
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                    tintColor="#ffffff"
                    size={34}
                  />
                </Pressable>

                {/* Profile button */}

                <Pressable
                  onPress={openProfileModal}
                  disabled={acting}
                  style={[styles.actionButton, isMobileWeb && styles.mobileActionButton, styles.profileButton, acting && styles.disabledButton]}
                >
                  <SymbolView
                    name={{ ios: 'person.crop.circle', android: 'person', web: 'person' } as any}
                    tintColor="#ffffff"
                    size={34}
                  />
                </Pressable>

                {/* Like button */}
                <Pressable
                  onPress={() => handleDecision('love')}
                  disabled={acting}
                  style={[styles.actionButton, isMobileWeb && styles.mobileActionButton, styles.loveButton, acting && styles.disabledButton]}
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

      <DiscoveryProfileModal
        visible={Boolean(profileModalProfile)}
        profile={profileModalProfile}
        onClose={closeProfileModal}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'scroll'
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  content: {
    flex: 1,
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  mobileContent: {
    padding: Spacing.two,
    paddingBottom: 76,
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
  mobileCard: {
    maxWidth: 380,
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
  chips: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  mobileActions: {
    gap: Spacing.three,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileActionButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  passButton: {
    backgroundColor: '#ff3131',
  },
  loveButton: {
    backgroundColor: '#17de60',
  },
  profileButton: {
    backgroundColor: '#d3dc2b',
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
