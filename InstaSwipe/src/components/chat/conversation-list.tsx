import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { type Conversation, getConversations } from '@/hooks/chat';
import { useTheme } from '@/hooks/use-theme';

interface ConversationListProps {
  onOpen: (conversation: Conversation) => void;
}

export function ConversationList({ onOpen }: ConversationListProps) {
  const theme = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getConversations();
        if (active) {
          setConversations(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load conversations');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <TouchableOpacity
        onPress={() => onOpen(item)}
        style={[styles.row, { borderColor: theme.tabActiveBorder }]}
        accessibilityRole="button"
        accessibilityLabel={`Open chat with ${item.otherUserName}`}
      >
        <Image
          source={item.otherUserPicture ? { uri: item.otherUserPicture } : undefined}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.rowBody}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {item.otherUserName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Tap to open your conversation
          </ThemedText>
        </View>
      </TouchableOpacity>
    ),
    [onOpen, theme],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.matchId}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <ThemedText type="subtitle" style={styles.title}>
          Your chats
        </ThemedText>
      }
      ListEmptyComponent={
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          {error ?? 'No matches yet. Start swiping to make a connection!'}
        </ThemedText>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#24172c',
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
