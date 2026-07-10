import { useCallback, useEffect, useRef, useState } from 'react';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { Platform } from 'react-native';

import { API_HOST, API_PORT, API_PREFIX } from '@/hooks/api';
import { authorizedFetch, getAccessToken, getCurrentUserId } from '@/hooks/auth';
import { normalizeMediaUrl } from '@/hooks/media';

const MATCHES_BASE_PATH = `${API_PREFIX}/matches`;
const PROFILE_BASE_PATH = `${API_PREFIX}/profile`;
const HISTORY_PAGE_SIZE = 50;

// STOMP-over-WebSocket endpoint registered by the backend (WebSocketConfig#/ws).
// It is a raw WebSocket (no SockJS), so @stomp/stompjs connects to it directly.
const WS_URL = (() => {
  if (API_PORT === '443') {
    return `wss://${API_HOST}/ws`;
  }
  if (API_PORT === '80') {
    return `ws://${API_HOST}/ws`;
  }
  return `ws://${API_HOST}:${API_PORT}/ws`;
})();

export interface ChatMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface Conversation {
  matchId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPicture: string | null;
  matchedAt: string;
}

interface MatchSummary {
  matchId: string;
  otherUserId: string;
  matchedAt: string;
}

/** Loads the current user's matches and resolves each counterpart's name + picture. */
export const getConversations = async (): Promise<Conversation[]> => {
  const response = await authorizedFetch(`${MATCHES_BASE_PATH}?page=0&size=50`, {
    method: 'GET',
    headers: { Accept: '*/*' },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Could not load conversations (status ${response.status})`);
  }

  const data = await response.json();
  const matches: MatchSummary[] = Array.isArray(data?.content) ? data.content : [];

  return Promise.all(
    matches.map(async (match) => {
      let otherUserName = 'InstaSwipe user';
      let otherUserPicture: string | null = null;
      try {
        const profile = await getPublicProfile(match.otherUserId);
        otherUserName = profile.displayName ?? otherUserName;
        otherUserPicture = normalizeMediaUrl(profile.profilePictureUrl);
      } catch {
        // A missing/hidden counterpart profile should not drop the conversation;
        // fall back to the placeholder name so the match is still openable.
      }
      return {
        matchId: match.matchId,
        otherUserId: match.otherUserId,
        otherUserName,
        otherUserPicture,
        matchedAt: match.matchedAt,
      };
    }),
  );
};

interface PublicProfile {
  id: string;
  displayName: string;
  profilePictureUrl: string | null;
}

const getPublicProfile = async (userId: string): Promise<PublicProfile> => {
  const response = await authorizedFetch(`${PROFILE_BASE_PATH}/${userId}`, {
    method: 'GET',
    headers: { Accept: '*/*' },
  });

  if (!response.ok) {
    throw new Error(`Could not load profile ${userId}`);
  }
  return response.json();
};

/** Chat history, newest-first (matching the backend's timestamp-descending order). */
const getChatHistory = async (matchId: string): Promise<ChatMessage[]> => {
  const response = await authorizedFetch(
    `${MATCHES_BASE_PATH}/${matchId}/messages?page=0&size=${HISTORY_PAGE_SIZE}`,
    { method: 'GET', headers: { Accept: '*/*' } },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Could not load messages (status ${response.status})`);
  }

  const data = await response.json();
  return Array.isArray(data?.content) ? (data.content as ChatMessage[]) : [];
};

const isNativePlatform = Platform.OS !== 'web';

const createStompClient = (token: string): Client => {
  const client = new Client({
    brokerURL: WS_URL,
    // The backend authenticates the STOMP CONNECT frame (not the HTTP handshake)
    // from this native header, and re-checks token expiry on every later frame.
    connectHeaders: { Authorization: `Bearer ${token}` },
    connectionTimeout: 10000,
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });

  if (isNativePlatform) {
    // React Native may deliver STOMP frames without the trailing NULL byte. Without
    // this, @stomp/stompjs can wait forever for CONNECTED/MESSAGE frames to finish.
    client.appendMissingNULLonIncoming = true;
    // Sending STOMP text frames with a trailing NULL can also be unreliable on
    // native. Binary frames preserve the terminator, and the protocol list keeps
    // this custom factory aligned with the default @stomp/stompjs WebSocket path.
    client.forceBinaryWSFrames = true;
    client.webSocketFactory = () => new WebSocket(WS_URL, client.stompVersions.protocolVersions()) as any;
  }

  return client;
};

export interface UseChatRoom {
  messages: ChatMessage[];
  currentUserId: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  send: (content: string) => boolean;
}

/**
 * Owns one conversation's realtime session: loads REST history, opens the STOMP
 * connection, subscribes to the match's user queue, and exposes a send function.
 * The backend echoes the sender's own message back over the same queue, so sent
 * messages arrive through the subscription (deduped by id) rather than optimistically.
 */
export function useChatRoom(matchId: string, otherUserId: string): UseChatRoom {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const upsert = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((message) => message.id === incoming.id)) {
        return prev;
      }
      // Keep newest-first so the inverted list renders newest at the bottom.
      return [incoming, ...prev].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    });
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: StompSubscription | undefined;

    (async () => {
      const uid = await getCurrentUserId();
      if (!active) {
        return;
      }
      currentUserIdRef.current = uid;
      setCurrentUserId(uid);

      try {
        const history = await getChatHistory(matchId);
        if (active) {
          setMessages(history);
        }
      } catch (historyError) {
        if (active) {
          setError(historyError instanceof Error ? historyError.message : 'Could not load messages');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }

      const token = await getAccessToken();
      if (!token || !active) {
        if (active) {
          setError('Could not connect to chat. Please sign in again.');
        }
        return;
      }

      const client = createStompClient(token);
      client.onWebSocketError = (event) => {
        console.warn('[chat] WebSocket error:', event);
        if (active) {
          setConnected(false);
          setError('Could not connect to chat. Check your network and try again.');
        }
      };
      client.onConnect = () => {
        if (!active) {
          return;
        }
        setConnected(true);
        // A successful (re)connect clears any transient connection error left over
        // from a dropped socket, so the red banner doesn't linger after we recover.
        setError(null);
        // The backend delivers via convertAndSendToUser(userId, "/queue/{roomId}").
        // RabbitMQ's STOMP relay requires a single-segment /queue/ name (no extra "/"),
        // so the room id is used directly — a "/chat/" sub-path resolves to an invalid
        // broker destination and the SUBSCRIBE/SEND are rejected.
        subscription = client.subscribe(`/user/queue/${matchId}`, (frame: IMessage) => {
          try {
            upsert(JSON.parse(frame.body) as ChatMessage);
          } catch {
            // Ignore frames that are not valid message JSON.
          }
        });
      };
      client.onStompError = (frame) => {
        // Broker/relay hiccups (e.g. "Connection to broker closed" when a backgrounded
        // tab misses heartbeats) are transient — the client auto-reconnects on
        // reconnectDelay. Reflect it only via the header's connection status rather than
        // a persistent red error banner.
        console.warn('[chat] STOMP error:', frame.headers['message'] ?? frame.body);
        if (active) {
          setConnected(false);
          setError(frame.headers['message'] ?? 'Chat connection failed');
        }
      };
      client.onWebSocketClose = (event) => {
        if (active) {
          console.warn('[chat] WebSocket closed:', event.code, event.reason);
          setConnected(false);
        }
      };

      clientRef.current = client;
      client.activate();
    })();

    return () => {
      active = false;
      subscription?.unsubscribe();
      void clientRef.current?.deactivate();
      clientRef.current = null;
    };
  }, [matchId, upsert]);

  const send = useCallback(
    (content: string) => {
      const text = content.trim();
      const client = clientRef.current;
      const senderId = currentUserIdRef.current;
      if (!text) {
        return false;
      }
      if (!senderId) {
        setError('Could not send yet. Please wait for your session to finish loading.');
        return false;
      }
      if (!client || !client.connected) {
        setError('Chat is still connecting. Please try again in a moment.');
        return false;
      }
      client.publish({
        destination: '/app/chat',
        body: JSON.stringify({
          chatRoomId: matchId,
          senderId,
          recipientId: otherUserId,
          content: text,
        }),
      });
      setError(null);
      return true;
    },
    [matchId, otherUserId],
  );

  return { messages, currentUserId, connected, loading, error, send };
}
