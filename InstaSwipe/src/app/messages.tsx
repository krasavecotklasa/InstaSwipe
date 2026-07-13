import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ChatRoom } from '@/components/chat/chat-room';
import { ConversationList } from '@/components/chat/conversation-list';
import { MaxContentWidth } from '@/constants/theme';
import type { Conversation } from '@/hooks/chat';
import Header from '@/components/header';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function MessagesScreen() {
  // In-screen navigation (list <-> room) via local state, matching the app's
  // pattern of switching modes within a tab rather than pushing router routes.
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const { isDesktopWeb } = useResponsiveLayout();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { marginLeft: isDesktopWeb ? 100 : 0 }]} edges={['top', 'left', 'right']}>
        {activeConversation ? (
          <ChatRoom
            conversation={activeConversation}
            onBack={() => setActiveConversation(null)}
          />
        ) : (
          <>
            <Header title='Your chats'/>
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
  },
});
