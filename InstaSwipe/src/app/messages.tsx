import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ChatRoom } from '@/components/chat/chat-room';
import { ConversationList } from '@/components/chat/conversation-list';
import { MaxContentWidth } from '@/constants/theme';
import type { Conversation } from '@/hooks/chat';
import Header from '@/components/header';

export default function MessagesScreen() {
  // In-screen navigation (list <-> room) via local state, matching the app's
  // pattern of switching modes within a tab rather than pushing router routes.
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {activeConversation ? (
          <ChatRoom
            conversation={activeConversation}
            onBack={() => setActiveConversation(null)}
          />
        ) : (
          <>
            <Header />
            <ConversationList onOpen={setActiveConversation} />
          </>
        )}
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
});
