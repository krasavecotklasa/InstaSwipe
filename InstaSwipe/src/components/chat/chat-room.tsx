import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { type ChatMessage, type Conversation, useChatRoom } from '@/hooks/chat';
import { useTheme } from '@/hooks/use-theme';

interface ChatRoomProps {
  conversation: Conversation;
  onBack: () => void;
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export function ChatRoom({ conversation, onBack }: ChatRoomProps) {
  const theme = useTheme();
  const { messages, currentUserId, connected, loading, error, send } = useChatRoom(
    conversation.matchId,
    conversation.otherUserId,
  );
  const [draft, setDraft] = useState('');

  const onSend = () => {
    if (send(draft)) {
      setDraft('');
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.senderId === currentUserId;
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: '#6249ca' }
              : { backgroundColor: theme.backgroundElement, borderColor: theme.tabActiveBorder, borderWidth: 1 },
          ]}
        >
          <ThemedText type="small" style={mine ? styles.bubbleTextMine : undefined}>
            {item.content}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={[styles.timeText, mine && styles.timeTextMine]}
          >
            {formatTime(item.timestamp)}
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: theme.tabActiveBorder }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to conversations"
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' } as any}
            tintColor="#8769ffbe"
            size={22}
          />
        </TouchableOpacity>
        <Image
          source={conversation.otherUserPicture ? { uri: conversation.otherUserPicture } : undefined}
          style={styles.headerAvatar}
          contentFit="cover"
        />
        <View style={styles.headerText}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {conversation.otherUserName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {connected ? 'Connected' : 'Connecting…'}
          </ThemedText>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messagesContent}
          ListEmptyComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyInverted}>
              {error ?? 'Say hello 👋'}
            </ThemedText>
          }
        />
      )}

      {!!error && !loading && (
        <ThemedText type="small" style={styles.errorText}>
          {error}
        </ThemedText>
      )}

      <View style={[styles.inputRow, { borderTopColor: theme.tabActiveBorder }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={theme.iconMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
          multiline
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={!draft.trim() || !connected}
          style={[styles.sendButton, { opacity: !draft.trim() || !connected ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <SymbolView
            name={{ ios: 'paperplane.fill', android: 'send', web: 'send' } as any}
            tintColor="#ffffff"
            size={20}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#24172c',
  },
  headerText: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.three,
    gap: Spacing.two,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  bubbleTextMine: {
    color: '#ffffff',
  },
  timeText: {
    fontSize: 10,
    lineHeight: 14,
    alignSelf: 'flex-end',
  },
  timeTextMine: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  emptyInverted: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
    transform: [{ scaleY: -1 }],
  },
  errorText: {
    color: '#ef4444',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6249ca',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
