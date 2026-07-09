import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard, type Post } from '@/components/post-card';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { fetchUserPostsPage } from '@/hooks/posts';
import { type DiscoveryProfile, useDiscoverySwipe } from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';

const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DISTANCE = 700;
const PROFILE_OPEN_THRESHOLD = 90;
const PROFILE_CLOSE_THRESHOLD = 80;
const PROFILE_POSTS_PAGE_SIZE = 10;
const PROFILE_POSTS_LOAD_DISTANCE = 280;

export default function MatchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const position = useRef(new Animated.ValueXY()).current;
  const sheetDragStartYRef = useRef<number | null>(null);
  const {
    currentProfile,
    loading,
    acting,
    error,
    resultMessage,
    beginDecision,
    finishDecision,
    handleDecision,
  } = useDiscoverySwipe();
  const bottomClearance = BottomTabInset + insets.bottom - Spacing.three;
  const [profileModalProfile, setProfileModalProfile] = useState<DiscoveryProfile | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [profilePostsPage, setProfilePostsPage] = useState(0);
  const [profilePostsLast, setProfilePostsLast] = useState(true);
  const [loadingProfilePosts, setLoadingProfilePosts] = useState(false);
  const [loadingMoreProfilePosts, setLoadingMoreProfilePosts] = useState(false);
  const [profilePostsError, setProfilePostsError] = useState<string | null>(null);

  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
  }, [currentProfile?.id, position]);

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

    if (contentOffset.y < -PROFILE_CLOSE_THRESHOLD) {
      closeProfileModal();
      return;
    }

    if (distanceFromBottom <= PROFILE_POSTS_LOAD_DISTANCE) {
      loadMoreProfilePosts();
    }
  };

  const handleSheetTouchStart = (event: GestureResponderEvent) => {
    sheetDragStartYRef.current = event.nativeEvent.pageY;
  };

  const handleSheetTouchEnd = (event: GestureResponderEvent) => {
    const startY = sheetDragStartYRef.current;
    sheetDragStartYRef.current = null;

    if (startY != null && event.nativeEvent.pageY - startY > PROFILE_CLOSE_THRESHOLD) {
      closeProfileModal();
    }
  };

  const resetCardPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
  };

  // Take the single-decision lock at gesture release (before the animation), so a
  // second swipe or a button tap during the 180ms animation can't queue a second
  // decision. The lock is released inside finishDecision once the swipe resolves.
  const finishSwipe = (action: 'love' | 'pass') => {
    if (!beginDecision()) {
      resetCardPosition();
      return;
    }

    const toX = action === 'love' ? SWIPE_OUT_DISTANCE : -SWIPE_OUT_DISTANCE;

    Animated.timing(position, {
      toValue: { x: toX, y: 0 },
      duration: 180,
      useNativeDriver: true,
    }).start(async () => {
      const applied = await finishDecision(action);
      if (!applied) {
        resetCardPosition();
      }
    });
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => (
        !acting &&
        Boolean(currentProfile) &&
        (
          (Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) ||
          (gesture.dy < -10 && Math.abs(gesture.dy) > Math.abs(gesture.dx))
        )
      ),
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
          position.setValue({ x: gesture.dx, y: gesture.dy * 0.2 });
        } else {
          position.setValue({ x: 0, y: Math.min(0, gesture.dy * 0.18) });
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          finishSwipe('love');
          return;
        }

        if (gesture.dx < -SWIPE_THRESHOLD) {
          finishSwipe('pass');
          return;
        }

        if (gesture.dy < -PROFILE_OPEN_THRESHOLD && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
          openProfileModal();
          resetCardPosition();
          return;
        }

        resetCardPosition();
      },
      onPanResponderTerminate: resetCardPosition,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [acting, currentProfile, position],
  );

  const cardAnimatedStyle = {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      {
        rotate: position.x.interpolate({
          inputRange: [-260, 0, 260],
          outputRange: ['-10deg', '0deg', '10deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  const passBadgeStyle = {
    opacity: position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, -40],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
  };

  const loveBadgeStyle = {
    opacity: position.x.interpolate({
      inputRange: [40, SWIPE_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header />
        <View style={[styles.content, { paddingBottom: bottomClearance }]}>
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
              <Animated.View
                {...panResponder.panHandlers}
                style={[styles.card, cardAnimatedStyle]}
              >
                <Image
                  source={currentProfile.profilePictureUrl ? { uri: currentProfile.profilePictureUrl } : undefined}
                  style={styles.portrait}
                  contentFit="cover"
                  transition={250}
                />
                <Animated.View style={[styles.decisionBadge, styles.passBadge, passBadgeStyle]}>
                  <ThemedText style={styles.decisionText}>PASS</ThemedText>
                </Animated.View>
                <Animated.View style={[styles.decisionBadge, styles.loveBadge, loveBadgeStyle]}>
                  <ThemedText style={styles.decisionText}>LIKE</ThemedText>
                </Animated.View>
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
              </Animated.View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => handleDecision('pass')}
                  disabled={acting}
                  style={[styles.actionButton, styles.passButton, acting && styles.disabledButton]}
                >
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
                    tintColor="#ffffff"
                    size={24}
                  />
                </Pressable>
                <Pressable
                  onPress={openProfileModal}
                  disabled={acting}
                  style={[styles.actionButton, styles.profileButton, acting && styles.disabledButton]}
                >
                  <SymbolView
                    name={{ ios: 'person.crop.circle', android: 'person', web: 'person' } as any}
                    tintColor="#ffffff"
                    size={24}
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
                    size={24}
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
        animationType="slide"
        onRequestClose={closeProfileModal}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView
            edges={['top', 'left', 'right', 'bottom']}
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
                <View
                  onTouchStart={handleSheetTouchStart}
                  onTouchEnd={handleSheetTouchEnd}
                  style={[styles.modalHeader, { borderBottomColor: theme.tabActiveBorder }]}
                >
                  <View style={styles.sheetHandle} />
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

                  <View style={[styles.aboutPanel, { borderColor: theme.tabActiveBorder }]}>
                    <ThemedText type="smallBold">About</ThemedText>
                    {!!profileModalProfile.bio && (
                      <ThemedText type="small" style={styles.aboutText}>
                        {profileModalProfile.bio}
                      </ThemedText>
                    )}
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
                    <ThemedText type="small" style={styles.modalErrorText}>
                      {profilePostsError}
                    </ThemedText>
                  )}
                </ScrollView>
              </>
            )}
          </SafeAreaView>
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
    width: '100%',
    marginLeft: Platform.OS === 'web' ? 100 : 0,
  },
  content: {
    flex: 1,
    backgroundColor: '#050208',
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
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  profileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 92,
    paddingHorizontal: Platform.OS === 'web' ? Spacing.five : Spacing.three,
    paddingVertical: Spacing.three,
    backgroundColor: 'rgba(41, 22, 70, 0.5)',
    gap: Spacing.one,
  },
  profileName: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 34 : 28,
    lineHeight: Platform.OS === 'web' ? 40 : 34,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  actionButton: {
    width: 56,
    height: 56,
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
    position: 'absolute',
    top: Spacing.three,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    textAlign: 'center',
    color: '#22c55e',
  },
  errorText: {
    position: 'absolute',
    top: Spacing.three,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    textAlign: 'center',
    color: '#ef4444',
  },
  decisionBadge: {
    position: 'absolute',
    top: Platform.OS === 'web' ? Spacing.five : Spacing.four,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  passBadge: {
    left: Spacing.four,
    borderColor: '#ff3131',
    transform: [{ rotate: '-10deg' }],
  },
  loveBadge: {
    right: Spacing.four,
    borderColor: '#17de60',
    transform: [{ rotate: '10deg' }],
  },
  decisionText: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  profileModal: {
    height: '75%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
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
  sheetHandle: {
    position: 'absolute',
    top: Spacing.one,
    left: '50%',
    width: 44,
    height: 4,
    marginLeft: -22,
    borderRadius: 2,
    backgroundColor: 'rgba(168, 146, 191, 0.55)',
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
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  aboutPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.one,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  aboutText: {
    lineHeight: 21,
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
  modalErrorText: {
    color: '#ef4444',
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
