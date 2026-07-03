import { FlatList, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard, Post } from '@/components/post-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MOCK_POSTS: Post[] = [
  {
    "caption": "Skibidi",
    "createdAt": "2026-07-03T07:33:08.993169400Z",
    "id": "6a4765b48091b216cd247d01",
    "likes": 123,
    "media": {
        "type": "IMAGE",
        "url": "https://i1.sndcdn.com/artworks-YDQOy2Pru5CA2rhs-x1uzgA-t1080x1080.jpg",
        "filename": "tung.jpg",
        "size": 43580
    },
    "userId": "6a476198037f9e89b6f5da33"
},
  {
    caption: 'Folk',
    createdAt: '2026-07-02T10:15:00.000000000Z',
    id: '2',
    likes: 67,
    media: {
      type: 'IMAGE',
      url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT_YFuM2oTw_hmsGafzkm_NNw-rWl5h7D0NsJ3hl_0JMQ&s',
      filename: 'folk.jpg',
      size: 52340
    },
    userId: '6a476198037f9e89b6f5da34'
  },
  {
    caption: 'Sunday morning means fresh croissants straight out of the oven! 🥐 The house smells absolutely incredible right now. Wish you could smell this through the screen!',
    createdAt: '2026-07-01T14:22:30.000000000Z',
    id: '3',
    likes: 245,
    media: {
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
      filename: 'croissants.jpg',
      size: 125680
    },
    userId: '6a476198037f9e89b6f5da35'
  }
];

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {(Platform.OS === 'ios' || Platform.OS === 'android') && (
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
        )}

        <FlatList
          data={MOCK_POSTS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          nestedScrollEnabled={Platform.OS === 'web'}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 0.5,
    borderBottomColor: '#6f0bda26',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#7157db',
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
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});

