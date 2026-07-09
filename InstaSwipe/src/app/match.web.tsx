import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard, type Post } from '@/components/post-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchUserPostsPage } from '@/hooks/posts';
import { type DiscoveryProfile, useDiscoverySwipe } from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import profile from './profile';

const PROFILE_POSTS_PAGE_SIZE = 10;
const PROFILE_POSTS_LOAD_DISTANCE = 320;

export default function MatchScreen() {
  const theme = useTheme();
  const {
    currentProfile,
    loading,
    acting,
    error,
    resultMessage,
    handleDecision,
  } = useDiscoverySwipe();
  const [profileModalProfile, setProfileModalProfile] = useState<DiscoveryProfile | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [profilePostsPage, setProfilePostsPage] = useState(0);
  const [profilePostsLast, setProfilePostsLast] = useState(true);
  const [loadingProfilePosts, setLoadingProfilePosts] = useState(false);
  const [loadingMoreProfilePosts, setLoadingMoreProfilePosts] = useState(false);
  const [profilePostsError, setProfilePostsError] = useState<string | null>(null);

  const loadProfilePosts = useCallback(async (profileId: string, page: number) => {
    if (page === 0) {
      setLoadingProfilePosts(true);
    } else {
      setLoadingMoreProfilePosts(true);
    }
    setProfilePostsError(null);

    try {
      const postsPage = await fetchUserPostsPage(profileId, page, PROFILE_POSTS_PAGE_SIZE);
      setProfilePosts((currentPosts) => {
        if (page === 0) {
          return postsPage.posts;
        }

        const seenPostIds = new Set(currentPosts.map((post) => post.id));
        const nextPosts = postsPage.posts.filter((post) => !seenPostIds.has(post.id));
        return [...currentPosts, ...nextPosts];
      });
      setProfilePostsPage(postsPage.page);
      setProfilePostsLast(postsPage.last);
    } catch (loadError) {
      setProfilePostsError(loadError instanceof Error ? loadError.message : 'Unable to load posts');
      if (page === 0) {
        setProfilePosts([]);
      }
    } finally {
      if (page === 0) {
        setLoadingProfilePosts(false);
      } else {
        setLoadingMoreProfilePosts(false);
      }
    }
  }, []);

  const openProfileModal = () => {
    if (!currentProfile) {
      return;
    }

    setProfileModalProfile(currentProfile);
    setProfilePosts([]);
    setProfilePostsPage(0);
    setProfilePostsLast(true);
    setProfilePostsError(null);
    void loadProfilePosts(currentProfile.id, 0);
  };

  const closeProfileModal = () => {
    setProfileModalProfile(null);
    setProfilePosts([]);
    setProfilePostsPage(0);
    setProfilePostsLast(true);
    setProfilePostsError(null);
  };

  const loadMoreProfilePosts = () => {
    if (
      !profileModalProfile ||
      loadingProfilePosts ||
      loadingMoreProfilePosts ||
      profilePostsLast
    ) {
      return;
    }

    void loadProfilePosts(profileModalProfile.id, profilePostsPage + 1);
  };

  const handleProfilePostsScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (distanceFromBottom <= PROFILE_POSTS_LOAD_DISTANCE) {
      loadMoreProfilePosts();
    }
  };

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

              {/* Pass button */}
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

                {/* Profile button */}

                <Pressable
                  onPress={openProfileModal}
                  disabled={acting}
                  style={[styles.actionButton, styles.profileButton, acting && styles.disabledButton]}
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

      <Modal
        visible={Boolean(profileModalProfile)}
        transparent
        animationType="fade"
        onRequestClose={closeProfileModal}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.profileModal,
              {
                backgroundColor: theme.background,
                borderColor: theme.tabActiveBorder,
              },
            ]}
          >
            {profileModalProfile && (
              <>
                <View style={[styles.modalHeader, { borderBottomColor: theme.tabActiveBorder }]}>
                  <Image
                    source={profileModalProfile.profilePictureUrl ? { uri: profileModalProfile.profilePictureUrl } : undefined}
                    style={styles.modalAvatar}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.modalTitleGroup}>
                    <ThemedText type="smallBold" style={styles.modalTitle} numberOfLines={1}>
                      {profileModalProfile.displayName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {profileModalProfile.age} · {profileModalProfile.country}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={closeProfileModal}
                    accessibilityRole="button"
                    accessibilityLabel="Close profile"
                    style={styles.closeButton}
                  >
                    <SymbolView
                      name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                      tintColor="#ffffff"
                      size={22}
                    />
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator
                  onScroll={handleProfilePostsScroll}
                  scrollEventThrottle={200}
                >
                  <View style={styles.bioInterestsRow}>
                    <View style={[styles.bioColumn, { borderColor: theme.tabActiveBorder }]}>
                      <ThemedText type="smallBold">Bio:</ThemedText>
                      {!!profileModalProfile.bio && (
                        <ThemedText type="small" style={styles.bio}>
                          {profileModalProfile.bio}
                        </ThemedText>
                      )}
                    </View>

                    <View style={[styles.interestsColumn, { borderColor: theme.tabActiveBorder }]}>
                      <ThemedText type="smallBold">My interests:</ThemedText>
                      <View style={styles.chips}>
                        {(profileModalProfile.interests ?? []).map((interest) => (
                          <View key={interest} style={[styles.chip, { borderColor: theme.tabActiveBorder }]}>
                            <ThemedText type="small" style={styles.chipText}>
                              {interest}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                  {loadingProfilePosts ? (
                    <View style={styles.modalState}>
                      <ActivityIndicator color={theme.text} />
                      <ThemedText type="small" themeColor="textSecondary">
                        Loading posts...
                      </ThemedText>
                    </View>
                  ) : profilePosts.length > 0 ? (
                    profilePosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))
                  ) : (
                    <View style={styles.modalState}>
                      <ThemedText type="smallBold">No posts yet</ThemedText>
                    </View>
                  )}

                  {loadingMoreProfilePosts && (
                    <View style={styles.modalFooterState}>
                      <ActivityIndicator color={theme.text} />
                    </View>
                  )}

                  {!loadingProfilePosts && profilePosts.length > 0 && profilePostsLast && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.endText}>
                      End of posts
                    </ThemedText>
                  )}

                  {!!profilePostsError && (
                    <ThemedText type="small" style={styles.errorText}>
                      {profilePostsError}
                    </ThemedText>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  bioColumn: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  interestsColumn: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
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
  chipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  profileButton: {
    backgroundColor: '#d3dc2b',
  },
  profileButtonText: {
    color: '#ffffff',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  profileModal: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    minHeight: 72,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1c1223',
  },
  modalTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: '#ffffff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2f2338',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 680,
  },
  modalScrollContent: {
    alignItems: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.four,
  },
  modalState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  modalFooterState: {
    paddingVertical: Spacing.three,
  },
  endText: {
    paddingVertical: Spacing.two,
    textAlign: 'center',
  },
  bioInterestsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
});
