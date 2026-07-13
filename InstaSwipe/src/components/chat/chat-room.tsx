import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import DiscoveryProfileModal from '@/components/discovery-profile-modal';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { type ChatMessage, type Conversation, useChatRoom } from '@/hooks/chat';
import { type DiscoveryProfile, getPublicProfile } from '@/hooks/matches';
import { useTheme } from '@/hooks/use-theme';
import { type GifProvider, type GifSearchItem, useGifSearch, useMessageGif } from '@/hooks/gifs';

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

function ChatMessageBubble({ item, mine }: { item: ChatMessage; mine: boolean }) {
  const theme = useTheme();
  const gif = useMessageGif(item.content);

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: '#6249ca' }
            : { borderColor: theme.tabActiveBorder, borderWidth: 1 },
          !mine && styles.bubbleTheirs,
          gif && styles.gifBubble,
        ]}
      >
        {gif ? (
          <Image
            source={{ uri: gif.url }}
            style={styles.messageGif}
            contentFit="cover"
            accessibilityLabel={`${gif.provider} GIF`}
          />
        ) : (
          <ThemedText type="small" style={mine ? styles.bubbleTextMine : { color: theme.textSecondary }}>
            {item.content}
          </ThemedText>
        )}
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
}

export function ChatRoom({ conversation, onBack }: ChatRoomProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { messages, currentUserId, loading, error, send } = useChatRoom(
    conversation.matchId,
    conversation.otherUserId,
  );
  const [draft, setDraft] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<DiscoveryProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('hello');
  const [gifProvider, setGifProvider] = useState<GifProvider>('all');
  const {
    results: gifResults,
    loading: gifsLoading,
    loadingMore: gifsLoadingMore,
    error: gifsError,
    loadMore: loadMoreGifs,
    hasMore: hasMoreGifs,
  } = useGifSearch(gifQuery, gifProvider, gifPickerOpen);
  const bottomClearance = BottomTabInset + insets.bottom;
  const hasDraft = draft.trim().length > 0;

  const onSend = () => {
    const message = draft.trim();
    if (!message) {
      return;
    }
    if (send(message)) {
      setDraft('');
    }
  };

  const handleMessageKeyPress = (event: { nativeEvent: { key: string; shiftKey?: boolean }; preventDefault?: () => void }) => {
    if (Platform.OS === 'web' && event.nativeEvent.key === 'Enter' && !event.nativeEvent.shiftKey) {
      event.preventDefault?.();
      onSend();
    }
  };

  const openProfile = async () => {
    if (loadingProfile) {
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);
    try {
      setSelectedProfile(await getPublicProfile(conversation.otherUserId));
    } catch (loadError) {
      setProfileError(loadError instanceof Error ? loadError.message : 'Could not load this profile.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const onSelectGif = (gif: GifSearchItem) => {
    if (send(gif.gifUrl)) {
      setGifPickerOpen(false);
      setDraft('');
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.senderId === currentUserId;

    return <ChatMessageBubble item={item} mine={mine} />;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { borderBottomColor: theme.tabActiveBorder }]}>
        <Pressable
          onPress={() => void openProfile()}
          disabled={loadingProfile}
          style={styles.headerAvatarButton}
          accessibilityRole="button"
          accessibilityLabel={`Open ${conversation.otherUserName}'s profile`}
        >
          <Image
            source={conversation.otherUserPicture ? { uri: conversation.otherUserPicture } : undefined}
            style={styles.headerAvatar}
            contentFit="cover"
          />
        </Pressable>
        <Pressable
          onPress={() => void openProfile()}
          disabled={loadingProfile}
          accessibilityRole="button"
          accessibilityLabel={`Open ${conversation.otherUserName}'s profile`}
          style={styles.headerNameButton}
        >
          <ThemedText type="smallBold" numberOfLines={1} style={styles.headerTitle}>
            {conversation.otherUserName}
          </ThemedText>
        </Pressable>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerCloseButton, { borderColor: theme.tabActiveBorder }]}
          accessibilityRole="button"
          accessibilityLabel="Close chat"
        >
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' } as any}
            tintColor="#8769ffbe"
            size={20}
          />
        </TouchableOpacity>
      </View>

      {profileError ? (
        <ThemedText type="small" style={styles.profileErrorText}>{profileError}</ThemedText>
      ) : null}

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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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

      {gifPickerOpen && (
        <View style={[styles.gifPicker, { borderTopColor: theme.tabActiveBorder, backgroundColor: theme.background }]}>
          <View style={styles.gifToolbar}>
            {(['all', 'giphy', 'klipy'] as GifProvider[]).map((provider) => (
              <Pressable
                key={provider}
                onPress={() => setGifProvider(provider)}
                accessibilityRole="button"
                accessibilityState={{ selected: gifProvider === provider }}
                style={[
                  styles.providerButton,
                  {
                    borderColor: theme.tabActiveBorder,
                    backgroundColor: gifProvider === provider ? '#6249ca' : 'transparent',
                  },
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={gifProvider === provider ? styles.providerButtonActiveText : { color: theme.textSecondary }}
                >
                  {provider === 'all' ? 'All' : provider === 'giphy' ? 'GIPHY' : 'Klipy'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={gifQuery}
            onChangeText={setGifQuery}
            placeholder="Search GIFs"
            placeholderTextColor={theme.iconMuted}
            style={[styles.gifSearchInput, { color: theme.text, borderColor: theme.tabActiveBorder }]}
            returnKeyType="search"
          />
          {gifsLoading ? (
            <View style={styles.gifStatus}>
              <ActivityIndicator color={theme.text} />
            </View>
          ) : gifsError ? (
            <ThemedText type="small" style={styles.errorText}>
              {gifsError}
            </ThemedText>
          ) : (
            <FlatList
              data={gifResults}
              keyExtractor={(item) => `${item.provider}-${item.id}-${item.gifUrl}`}
              numColumns={3}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gifResults}
              columnWrapperStyle={styles.gifResultsRow}
              onEndReached={() => {
                if (!gifsLoading && !gifsLoadingMore && hasMoreGifs) {
                  void loadMoreGifs();
                }
              }}
              onEndReachedThreshold={0.35}
              ListFooterComponent={
                gifsLoadingMore ? (
                  <View style={styles.gifStatus}>
                    <ActivityIndicator color={theme.text} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <ThemedText type="small" themeColor="textSecondary" style={styles.gifEmpty}>
                  No GIFs found
                </ThemedText>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelectGif(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Send ${item.provider} GIF`}
                  style={({ pressed }) => [styles.gifResultButton, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Image
                    source={{ uri: item.previewUrl || item.gifUrl }}
                    style={styles.gifResultImage}
                    contentFit="cover"
                    accessibilityLabel={item.title || `${item.provider} GIF`}
                  />
                  <ThemedText type="small" style={styles.gifProviderLabel}>
                    {item.provider}
                  </ThemedText>
                </Pressable>
              )}
            />
          )}
        </View>
      )}

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.tabActiveBorder,
            paddingBottom: bottomClearance + Spacing.two,
          },
        ]}
      >
        <Pressable
          onPress={() => setGifPickerOpen((open) => !open)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={gifPickerOpen ? 'Close GIF picker' : 'Open GIF picker'}
          accessibilityState={{ expanded: gifPickerOpen }}
          style={({ pressed }) => [
            styles.gifButton,
            {
              borderColor: theme.tabActiveBorder,
              backgroundColor: gifPickerOpen ? '#6249ca' : 'transparent',
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <ThemedText type="smallBold" style={gifPickerOpen ? styles.providerButtonActiveText : { color: theme.textSecondary }}>
            GIF
          </ThemedText>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={(text) => setDraft(text)}
          placeholder="Message…"
          placeholderTextColor={theme.iconMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.tabActiveBorder }]}
          multiline
          returnKeyType="send"
          submitBehavior={Platform.OS === 'web' ? 'newline' : 'submit'}
          onSubmitEditing={Platform.OS === 'web' ? undefined : onSend}
          onKeyPress={handleMessageKeyPress}
        />
        <Pressable
          onPress={onSend}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !hasDraft }}
          style={({ pressed }) => [
            styles.sendButton,
            {
              borderColor: theme.tabActiveBorder,
              opacity: hasDraft ? (pressed ? 0.75 : 1) : 0.5,
            },
          ]}
        >
          <SymbolView
            name={{ ios: 'paperplane', android: 'send', web: 'send' } as any}
            tintColor="#8769ffbe"
            size={20}
            pointerEvents="none"
          />
        </Pressable>
      </View>

      <DiscoveryProfileModal
        visible={Boolean(selectedProfile)}
        profile={selectedProfile}
        initialDecision="liked"
        onClose={() => setSelectedProfile(null)}
      />
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
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
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
  headerAvatarButton: {
    position: 'absolute',
    left: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#24172c',
  },
  headerNameButton: {
    maxWidth: '70%',
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
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
  bubbleTheirs: {
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  gifBubble: {
    paddingHorizontal: Spacing.half,
    paddingTop: Spacing.half,
  },
  messageGif: {
    width: 220,
    height: 220,
    maxWidth: '100%',
    borderRadius: 10,
    backgroundColor: '#24172c',
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
  },
  errorText: {
    color: '#ef4444',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  profileErrorText: {
    color: '#ef4444',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    textAlign: 'center',
  },
  gifPicker: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    maxHeight: 320,
  },
  gifToolbar: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  providerButton: {
    height: 32,
    minWidth: 64,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerButtonActiveText: {
    color: '#ffffff',
  },
  gifSearchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  gifStatus: {
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifResults: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    minHeight: 112,
  },
  gifResultsRow: {
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  gifResultButton: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#24172c',
  },
  gifResultImage: {
    width: '100%',
    height: '100%',
  },
  gifProviderLabel: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    fontSize: 10,
    lineHeight: 12,
  },
  gifEmpty: {
    width: '100%',
    textAlign: 'center',
    alignSelf: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  gifButton: {
    width: 48,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
