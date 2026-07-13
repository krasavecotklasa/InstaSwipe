import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { PostCard, type Post } from '@/components/post-card';
import ResponsiveModalSheet, { ModalSheetPanel } from '@/components/responsive-modal-sheet';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import {
  decideOnProfile,
  type DiscoveryProfile,
  getProfileDecision,
  type ProfileDecision,
  setProfileDecision,
} from '@/hooks/matches';
import { fetchUserPostsPage } from '@/hooks/posts';
import { useTheme } from '@/hooks/use-theme';

const PROFILE_POSTS_PAGE_SIZE = 10;
const PROFILE_POSTS_LOAD_DISTANCE = 300;
const PROFILE_CLOSE_THRESHOLD = 80;

interface DiscoveryProfileModalProps {
  visible: boolean;
  profile: DiscoveryProfile | null;
  onClose: () => void;
  initialDecision?: ProfileDecision | null;
  onDecision?: (action: 'love' | 'pass') => Promise<boolean>;
}

export default function DiscoveryProfileModal({
  visible,
  profile,
  onClose,
  initialDecision = null,
  onDecision,
}: DiscoveryProfileModalProps) {
  const theme = useTheme();
  const isWeb = Platform.OS === 'web';
  const activeProfileIdRef = useRef<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsPage, setPostsPage] = useState(0);
  const [postsLast, setPostsLast] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ProfileDecision | null>(initialDecision);
  const [loadingDecision, setLoadingDecision] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const resetPosts = useCallback(() => {
    setPosts([]);
    setPostsPage(0);
    setPostsLast(true);
    setPostsError(null);
    setLoadingPosts(false);
    setLoadingMorePosts(false);
  }, []);

  const loadProfilePosts = useCallback(async (profileId: string, page: number) => {
    if (page === 0) {
      setLoadingPosts(true);
    } else {
      setLoadingMorePosts(true);
    }
    setPostsError(null);

    try {
      const postsPageResponse = await fetchUserPostsPage(profileId, page, PROFILE_POSTS_PAGE_SIZE);
      if (activeProfileIdRef.current !== profileId) {
        return;
      }

      setPosts((currentPosts) => {
        if (page === 0) {
          return postsPageResponse.posts;
        }

        const seenPostIds = new Set(currentPosts.map((post) => post.id));
        const nextPosts = postsPageResponse.posts.filter((post) => !seenPostIds.has(post.id));
        return [...currentPosts, ...nextPosts];
      });
      setPostsPage(postsPageResponse.page);
      setPostsLast(postsPageResponse.last);
    } catch (loadError) {
      if (activeProfileIdRef.current !== profileId) {
        return;
      }

      setPostsError(loadError instanceof Error ? loadError.message : 'Unable to load posts');
      if (page === 0) {
        setPosts([]);
      }
    } finally {
      if (activeProfileIdRef.current !== profileId) {
        return;
      }

      if (page === 0) {
        setLoadingPosts(false);
      } else {
        setLoadingMorePosts(false);
      }
    }
  }, []);

  const targetProfileId = visible && profile ? profile.id : null;
  if (targetProfileId !== loadedProfileId) {
    setLoadedProfileId(targetProfileId);
    resetPosts();
  }

  useEffect(() => {
    activeProfileIdRef.current = targetProfileId;
    if (targetProfileId) {
      void loadProfilePosts(targetProfileId, 0);
    }
  }, [targetProfileId, loadProfilePosts]);

  useEffect(() => {
    let active = true;
    setDecision(initialDecision);
    setDecisionError(null);

    if (!targetProfileId || initialDecision) {
      if (targetProfileId && initialDecision) {
        void setProfileDecision(targetProfileId, initialDecision);
      }
      setLoadingDecision(false);
      return () => {
        active = false;
      };
    }

    setLoadingDecision(true);
    void getProfileDecision(targetProfileId).then((storedDecision) => {
      if (active) {
        setDecision(storedDecision);
        setLoadingDecision(false);
      }
    });

    return () => {
      active = false;
    };
  }, [targetProfileId, initialDecision]);

  const handleDecision = async (action: 'love' | 'pass') => {
    if (!profile || savingDecision || decision) {
      return;
    }

    setSavingDecision(true);
    setDecisionError(null);
    try {
      const applied = onDecision
        ? await onDecision(action)
        : Boolean(await decideOnProfile(profile.id, action));
      if (!applied) {
        setDecisionError('Could not save your choice. Please try again.');
        return;
      }

      const nextDecision = action === 'love' ? 'liked' : 'passed';
      await setProfileDecision(profile.id, nextDecision);
      setDecision(nextDecision);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Could not save your choice.');
    } finally {
      setSavingDecision(false);
    }
  };

  const loadMorePosts = () => {
    if (!profile || loadingPosts || loadingMorePosts || postsLast) {
      return;
    }

    void loadProfilePosts(profile.id, postsPage + 1);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (!isWeb && contentOffset.y < -PROFILE_CLOSE_THRESHOLD) {
      onClose();
      return;
    }

    if (distanceFromBottom <= PROFILE_POSTS_LOAD_DISTANCE) {
      loadMorePosts();
    }
  };

  return (
    <ResponsiveModalSheet
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel="Close profile"
    >
      {profile && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          onScroll={handleScroll}
          scrollEventThrottle={200}
        >
          <ModalSheetPanel title="Profile">
            <View style={styles.profileBlock}>
              <View style={styles.profileTopRow}>
                <Image
                  source={profile.profilePictureUrl ? { uri: profile.profilePictureUrl } : undefined}
                  style={styles.avatar}
                  contentFit="cover"
                  transition={200}
                />

                <View style={styles.profileMeta}>
                  <ThemedText type="smallBold" style={styles.profileName}>
                    {profile.displayName}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Age: <ThemedText type="small" themeColor="textSecondary" style={styles.profileMetaDetail}>{profile.age}</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Country: <ThemedText type="small" themeColor="textSecondary" style={styles.profileMetaDetail}>{profile.country}</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Gender: <ThemedText type="small" themeColor="textSecondary" style={styles.profileMetaDetail}>{profile.gender}</ThemedText>
                  </ThemedText>
                </View>

                <View style={styles.decisionActions}>
                  {loadingDecision ? (
                    <ActivityIndicator color={theme.text} />
                  ) : decision ? (
                    <ThemedText
                      type="smallBold"
                      style={decision === 'liked' ? {color: '#17de60'} : {color: '#ef4444'}}
                    >
                      {decision === 'liked' ? 'Liked' : 'Passed'}
                    </ThemedText>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => void handleDecision('pass')}
                        disabled={savingDecision}
                        accessibilityRole="button"
                        accessibilityLabel={`Pass on ${profile.displayName}`}
                        style={[styles.decisionButton, styles.passButton, savingDecision && styles.disabledButton]}
                      >
                        <SymbolView
                          name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                          tintColor="#ffffff"
                          size={24}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => void handleDecision('love')}
                        disabled={savingDecision}
                        accessibilityRole="button"
                        style={[styles.decisionButton, styles.likeButton, savingDecision && styles.disabledButton]}
                      >
                        <SymbolView
                          name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' } as any}
                          tintColor="#ffffff"
                          size={24}
                        />
                      </Pressable>
                    </>
                  )}
                </View>
              </View>

              {decisionError ? (
                <ThemedText type="small" style={styles.errorText}>{decisionError}</ThemedText>
              ) : null}

              <View style={styles.bioInterestsRow}>
                <View style={[styles.bioColumn, { borderColor: theme.tabActiveBorder }]}>
                  <ThemedText type="smallBold">About:</ThemedText>
                  {!!profile.bio && (
                    <ThemedText type="small" style={styles.bio}>
                      {profile.bio}
                    </ThemedText>
                  )}
                  <View style={styles.chips}>
                    {(profile.interests ?? []).map((interest) => (
                      <View key={interest} style={[styles.chip, { backgroundColor: theme.backgroundSelected, borderColor: theme.tabActiveBorder }]}>
                        <ThemedText type="small" style={styles.chipText}>
                          {interest}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </ModalSheetPanel>

          <View style={styles.postsSection}>
            <View style={styles.postsHeader}>
              <ThemedText type="smallBold" style={styles.postsTitle}>
                Posts
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </ThemedText>
            </View>

            {loadingPosts ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={theme.text} />
              </View>
            ) : postsError ? (
              <View style={[styles.notice, { borderColor: '#ef4444' }]}>
                <ThemedText type="small" style={styles.errorText}>
                  {postsError}
                </ThemedText>
              </View>
            ) : posts.length > 0 ? (
              <View style={styles.postsList}>
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <ThemedText type="small" themeColor="textSecondary">
                  No posts yet.
                </ThemedText>
              </View>
            )}

            {loadingMorePosts && (
              <View style={styles.footerState}>
                <ActivityIndicator color={theme.text} />
              </View>
            )}

            {!loadingPosts && posts.length > 0 && postsLast && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.endText}>
                End of posts
              </ThemedText>
            )}
          </View>
        </ScrollView>
      )}
    </ResponsiveModalSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  profileBlock: {
    gap: Spacing.three,
  },
  profileTopRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  avatar: {
    width: Platform.OS === 'web' ? 120 : 80,
    height: Platform.OS === 'web' ? 120 : 80,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#6249cabe',
    backgroundColor: Colors.dark.backgroundSelected,
  },
  profileMeta: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.one,
  },
  decisionActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    minHeight: 40,
  },
  decisionButton: {
    width: 50,
    height: 50,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  passButton: {
    backgroundColor: '#ff3131',
  },
  likeButton: {
    backgroundColor: '#17de60',
  },
  disabledButton: {
    opacity: 0.6,
  },
  decisionButtonText: {
    color: '#ffffff',
  },
  likedText: {
    color: '#17de60',
  },
  passedText: {
    color: '#ef4444',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  profileMetaDetail: {
    fontWeight: '800',
  },
  bioInterestsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'stretch',
    flexWrap: 'wrap',
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
  bio: {
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginVertical: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  postsSection: {
    gap: Spacing.three,
  },
  postsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  postsTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  postsList: {
    width: '100%',
  },
  notice: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  errorText: {
    color: '#ef4444',
  },
  emptyState: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerState: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  endText: {
    paddingVertical: Spacing.two,
    textAlign: 'center',
  },
});
