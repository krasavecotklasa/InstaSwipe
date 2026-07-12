import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard, type Post } from '@/components/post-card';
import PostComposer from '@/components/post-composer';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import { fetchFeed } from '@/hooks/posts';
import { type DiscoveryProfile, getPublicProfile } from '@/hooks/matches';
import DiscoveryProfileModal from '@/components/discovery-profile-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';


function ComposerEntry({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.composer,
        { backgroundColor: theme.tabActiveBackground, borderColor: theme.tabActiveBorder },
        pressed && styles.composerPressed,
      ]}
    >
      <View style={styles.composerBadge}>
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' } as any}
          tintColor="#8769ffbe"
          size={22}
        />
      </View>
      <ThemedText style={[styles.composerText, { color: theme.iconMuted }]}>Create a new post</ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerVisible, setComposerVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<DiscoveryProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const hasLoadedPosts = useRef(false);
  const insets = useSafeAreaInsets();
  const { isMobileWeb, isDesktopWeb } = useResponsiveLayout();


  const loadPosts = useCallback(async () => {

    if (!hasLoadedPosts.current) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const nextPosts = await fetchFeed();
      setPosts(nextPosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load posts');
      if (!hasLoadedPosts.current) {
        setPosts([]);
      }
    } finally {
      hasLoadedPosts.current = true;
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts]),
  );

  const openAuthorProfile = useCallback(async (userId: string) => {
    setProfileError(null);

    try {
      const nextProfile = await getPublicProfile(userId);
      setSelectedProfile(nextProfile);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Unable to load profile');
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, { marginLeft: isDesktopWeb ? 100 : 0 }]} edges={['top', 'left', 'right']}>
          <Header title='InstaSwipe'/>

          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCard post={item} onAuthorPress={openAuthorProfile} onMediaProcessing={loadPosts} />
            )}
            ListHeaderComponent={<ComposerEntry onPress={() => setComposerVisible(true)} />}
            contentContainerStyle={[styles.listContent, isMobileWeb && styles.mobileListContent]}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            nestedScrollEnabled={Platform.OS === 'web'}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              ) : error ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{error}</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No posts yet.</Text>
                </View>
              )
            }
          />

          {!!profileError && (
            <View style={styles.profileErrorNotice}>
              <Text style={styles.emptyText}>{profileError}</Text>
            </View>
          )}

          <PostComposer
            visible={composerVisible}
            onClose={() => setComposerVisible(false)}
            onPosted={loadPosts}
          />

          <DiscoveryProfileModal
            visible={Boolean(selectedProfile)}
            profile={selectedProfile}
            onClose={() => setSelectedProfile(null)}
          />
        </SafeAreaView>
      </ThemedView>
    </KeyboardAvoidingView>
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
  },

  listContent: {
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  mobileListContent: {
    paddingBottom: 80,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    marginHorizontal: 'auto',
    paddingHorizontal: Spacing.one,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderRadius: 8,
    width: Platform.OS === 'web' ? '80%' : '95%',
    maxWidth: 'auto',
  },
  composerPressed: {
    opacity: 0.85,
  },
  composerBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
  profileErrorNotice: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.three,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: Spacing.two,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
});
