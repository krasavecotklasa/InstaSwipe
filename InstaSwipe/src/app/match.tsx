import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DiscoveryProfileModal from '@/components/discovery-profile-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { type DiscoveryProfile, useDiscoverySwipe } from '@/hooks/matches';
import { MAX_VISIBLE_MATCH_INTERESTS } from '@/constants/interests';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';

const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_DISTANCE = 700;
const PROFILE_OPEN_THRESHOLD = 90;

export default function MatchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const position = useRef(new Animated.ValueXY()).current;
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

  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
  }, [currentProfile?.id, position]);

  const openProfileModal = () => {
    if (!currentProfile) {
      return;
    }

    setProfileModalProfile(currentProfile);
  };

  const closeProfileModal = () => {
    setProfileModalProfile(null);
  };

  const resetCardPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 6,
      tension: 60,
    }).start();
  };

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
        <Header title='Match'/>
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

      <DiscoveryProfileModal
        visible={Boolean(profileModalProfile)}
        profile={profileModalProfile}
        onClose={closeProfileModal}
        onDecision={handleDecision}
      />
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
});
