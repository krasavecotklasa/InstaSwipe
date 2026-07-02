import { FlatList, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { PostCard, Post } from '@/components/post-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    username: 'tung',
    avatarUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRdw33vu9iFW5DABhWzI4R8E_XpVfrVWYbvjBVF16z5iSiuLnahbhuS49Zn&s=10',
    date: '2 hours ago',
    description: '18M how do i look like??',
    imageUrl: 'https://i1.sndcdn.com/artworks-YDQOy2Pru5CA2rhs-x1uzgA-t1080x1080.jpg',
    likes: 123,
  },
  {
    id: '2',
    username: 'folk',
    avatarUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT_YFuM2oTw_hmsGafzkm_NNw-rWl5h7D0NsJ3hl_0JMQ&s',
    date: '5 folks ago',
    description: 'Folk',
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT_YFuM2oTw_hmsGafzkm_NNw-rWl5h7D0NsJ3hl_0JMQ&s',
    likes: 67,
  },
  {
    id: '3',
    username: 'chloe_bakes',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    date: 'Yesterday',
    description: 'Sunday morning means fresh croissants straight out of the oven! 🥐 The house smells absolutely incredible right now. Wish you could smell this through the screen!',
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
    likes: 245,
    shares: 11,
  }
];

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText style={styles.logoText}>
            InstaSwipe
          </ThemedText>
          <View style={styles.headerActions}>
            <SymbolView
              name={{ ios: 'bell', android: 'notifications', web: 'notifications' } as any}
              tintColor={theme.text}
              size={24}
            />
          </View>
        </View>

        <FlatList
          data={MOCK_POSTS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={Platform.OS === 'web' ? <WebBadge /> : null}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(168, 146, 191, 0.15)',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#6249ca', // follows color scheme branding style
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerIcon: {
    padding: Spacing.one,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});

