import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
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

import { PostCard, type Post } from '@/components/post-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { type DiscoveryProfile } from '@/hooks/matches';
import { fetchUserPostsPage } from '@/hooks/posts';
import { useTheme } from '@/hooks/use-theme';

const PROFILE_POSTS_PAGE_SIZE = 10;
const PROFILE_POSTS_LOAD_DISTANCE = 300;
const PROFILE_CLOSE_THRESHOLD = 80;

interface DiscoveryProfileModalProps {
  visible: boolean;
  profile: DiscoveryProfile | null;
  onClose: () => void;
}

export default function DiscoveryProfileModal({
  visible,
  profile,
  onClose,
}: DiscoveryProfileModalProps) {
  const theme = useTheme();
  const isWeb = Platform.OS === 'web';
  const activeProfileIdRef = useRef<string | null>(null);
  const sheetDragStartYRef = useRef<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsPage, setPostsPage] = useState(0);
  const [postsLast, setPostsLast] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!visible || !profile) {
      activeProfileIdRef.current = null;
      resetPosts();
      return;
    }

    activeProfileIdRef.current = profile.id;
    resetPosts();
    void loadProfilePosts(profile.id, 0);
  }, [loadProfilePosts, profile, resetPosts, visible]);

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

  const handleSheetTouchStart = (event: GestureResponderEvent) => {
    sheetDragStartYRef.current = event.nativeEvent.pageY;
  };

  const handleSheetTouchEnd = (event: GestureResponderEvent) => {
    const startY = sheetDragStartYRef.current;
    sheetDragStartYRef.current = null;

    if (!isWeb && startY != null && event.nativeEvent.pageY - startY > PROFILE_CLOSE_THRESHOLD) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, isWeb ? styles.webBackdrop : styles.mobileBackdrop]}>
        <SafeAreaView
          edges={isWeb ? ['left', 'right'] : ['left', 'right', 'bottom']}
          style={[
            styles.surface,
            isWeb ? styles.webSurface : styles.mobileSurface,
            {
              backgroundColor: theme.background,
              borderColor: theme.tabActiveBorder,
            },
          ]}
        >
          <View
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
            style={[styles.surfaceHeader, { borderBottomColor: theme.tabActiveBorder }]}
          >
            {isWeb ? (
              <ThemedText type="smallBold" style={styles.surfaceHeaderTitle}>
                Profile
              </ThemedText>
            ) : (
              <View style={styles.sheetHandle} />
            )}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close profile"
              style={[styles.headerCloseButton, { borderColor: theme.tabActiveBorder }]}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                tintColor="#8769ffbe"
                size={20}
              />
            </Pressable>
          </View>

          {profile && (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
              onScroll={handleScroll}
              scrollEventThrottle={200}
            >
              <View style={[styles.panel, { borderColor: theme.tabActiveBorder }]}>
                <View style={styles.panelHeader}>
                  <ThemedText style={styles.panelHeaderText} type="smallBold">
                    Profile
                  </ThemedText>
                </View>

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
                  </View>

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
                          <View key={interest} style={[styles.chip, { borderColor: theme.tabActiveBorder }]}>
                            <ThemedText type="small" style={styles.chipText}>
                              {interest}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </View>

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
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  webBackdrop: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  mobileBackdrop: {
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  surface: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  webSurface: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '88%',
    borderRadius: 8,
  },
  mobileSurface: {
    height: '75%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  surfaceHeader: {
    minHeight: 56,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  surfaceHeaderTitle: {
    marginRight: 'auto',
  },
  headerCloseButton: {
    position: 'absolute',
    right: Spacing.three,
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(168, 146, 191, 0.55)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  panel: {
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  panelHeaderText: {
    bottom: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#2f2338',
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
