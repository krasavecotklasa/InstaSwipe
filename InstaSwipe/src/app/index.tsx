import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard, type Post } from '@/components/post-card';
import PostComposer from '@/components/post-composer';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import Header from '@/components/header';
import { fetchPostsByUserIds } from '@/hooks/posts';
import { TARGET_USER_IDS } from '@/hooks/api';
import { fetchFeed } from '@/hooks/posts';

function ComposerEntry({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.composer,
        { borderColor: theme.tabActiveBorder },
        pressed && styles.composerPressed,
      ]}
    >
      <View style={[styles.composerBadge, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={{ ios: 'plus', android: 'add', web: 'add' } as any}
          tintColor="#ffffff"
          size={22}
        />
      </View>
      <ThemedText style={[styles.composerText, { color: theme.iconMuted }]}>
        Share a new post
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadPosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextPosts = await fetchPostsByUserIds(TARGET_USER_IDS);
        if (isActive) {
          setPosts(nextPosts);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Unable to load posts');
          setPosts([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Header />

        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          ListHeaderComponent={<ComposerEntry onPress={() => setComposerVisible(true)} />}
          contentContainerStyle={styles.listContent}
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

        <PostComposer
          visible={composerVisible}
          onClose={() => setComposerVisible(false)}
          onPosted={loadPosts}
        />
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

  listContent: {
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
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
});
