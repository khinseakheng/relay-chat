import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { App } from 'antd';
import type { Conversation, ConversationPage, Message } from '../types';
import { apiRequest, ensureAccessToken, refreshSession } from '../lib/api';
import { chatSocket, connectAgentSocket } from '../lib/socket';
import { useAuth } from './useAuth';

type Attachment = { name: string; mime: string; url: string; key?: string; size?: number };
type ConversationUpdate = Partial<Pick<Conversation, 'status' | 'assignedMemberId' | 'tags' | 'notes'>> & {
  unread?: number;
};
type ConversationContextValue = {
  conversations: Conversation[];
  loading: boolean;
  typingConversationId: string | null;
  conversationVersion: number;
  refresh(): Promise<void>;
  query(input: {
    q: string;
    status: 'all' | 'open' | 'closed';
    sort: 'newest' | 'oldest';
    page: number;
    limit?: number;
  }): Promise<ConversationPage>;
  update(id: string, changes: ConversationUpdate): Promise<void>;
  send(conversation: Conversation, text: string, attachment?: Attachment): void;
  join(id: string): void;
  markRead(id: string): void;
  setTyping(id: string, typing: boolean): void;
};

const ConversationContext = createContext<ConversationContextValue | null>(null);
let notificationAudioContext: AudioContext | null = null;

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { message: toast } = App.useApp();
  const { agent } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);
  const [conversationVersion, setConversationVersion] = useState(0);
  const conversationsRef = useRef<Conversation[]>([]);
  const notifiedMessageIds = useRef(new Set<string>());

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const unlock = () => {
      void unlockNotificationAudio().then((unlocked) => {
        if (!unlocked) return;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      });
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!agent?.workspaceId) return;
    setLoading(true);
    try {
      const result = await apiRequest<ConversationPage>(
        '/conversations?status=all&sort=newest&page=1&limit=30',
      );
      setConversations(result.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load conversations');
    } finally {
      setLoading(false);
    }
  }, [agent, toast]);

  const query = useCallback(
    async (input: {
      q: string;
      status: 'all' | 'open' | 'closed';
      sort: 'newest' | 'oldest';
      page: number;
      limit?: number;
    }) => {
      const params = new URLSearchParams({
        q: input.q,
        status: input.status,
        sort: input.sort,
        page: String(input.page),
        limit: String(input.limit || 30),
      });
      const result = await apiRequest<ConversationPage>(`/conversations?${params}`);
      setConversations((current) => {
        const merged = new Map(current.map((conversation) => [conversation.id, conversation]));
        for (const conversation of result.items) merged.set(conversation.id, conversation);
        return [...merged.values()];
      });
      return result;
    },
    [],
  );

  useEffect(() => {
    if (!agent?.workspaceId) {
      chatSocket.disconnect();
      setConversations([]);
      return;
    }
    const connect = () =>
      ensureAccessToken()
        .then(connectAgentSocket)
        .catch(() => undefined);
    void connect();
    void refresh();

    const onDisconnect = (reason: string) => {
      if (reason !== 'io server disconnect') return;
      window.setTimeout(
        () =>
          void refreshSession()
            .then((session) => connectAgentSocket(session.accessToken))
            .catch(() => undefined),
        250,
      );
    };

    const onUpdate = (updated: Conversation) => {
      const previous = conversationsRef.current.find((item) => item.id === updated.id);
      setConversationVersion((version) => version + 1);
      const incoming = updated.messages.at(-1);
      if (
        incoming?.sender === 'visitor' &&
        previous?.messages.at(-1)?.id !== incoming.id &&
        !notifiedMessageIds.current.has(incoming.id)
      ) {
        notifiedMessageIds.current.add(incoming.id);
        if (notifiedMessageIds.current.size > 500) {
          const oldest = notifiedMessageIds.current.values().next().value;
          if (oldest) notifiedMessageIds.current.delete(oldest);
        }
        toast.info({
          key: `visitor-message-${incoming.id}`,
          content: `${updated.visitor.name}: ${incoming.text || incoming.attachmentName || 'Attachment'}`,
        });
        if (localStorage.getItem('relay-notification-sounds') !== 'false') playNotificationSound();
      }
      setConversations((current) => {
        const exists = current.some((item) => item.id === updated.id);
        return exists
          ? current.map((item) => (item.id === updated.id ? updated : item))
          : [updated, ...current];
      });
    };
    const onTyping = (event: { conversationId: string; sender: string; typing: boolean }) => {
      if (event.sender === 'visitor') setTypingConversationId(event.typing ? event.conversationId : null);
    };
    const onPresence = (event: { conversationId: string; online: boolean; lastSeenAt: string | null }) => {
      setConversations((current) =>
        current.map((item) => (item.id === event.conversationId ? { ...item, ...event } : item)),
      );
    };
    const onRead = (event: { conversationId: string; reader: 'visitor' | 'agent'; readAt: string }) => {
      const sender = event.reader === 'visitor' ? 'agent' : 'visitor';
      setConversations((current) =>
        current.map((item) =>
          item.id === event.conversationId
            ? {
                ...item,
                unread: event.reader === 'agent' ? 0 : item.unread,
                messages: item.messages.map((message) =>
                  message.sender === sender && !message.readAt
                    ? { ...message, readAt: event.readAt }
                    : message,
                ),
              }
            : item,
        ),
      );
    };
    chatSocket.on('conversation:updated', onUpdate);
    chatSocket.on('typing', onTyping);
    chatSocket.on('conversation:presence', onPresence);
    chatSocket.on('messages:read', onRead);
    chatSocket.on('disconnect', onDisconnect);
    return () => {
      chatSocket.off('conversation:updated', onUpdate);
      chatSocket.off('typing', onTyping);
      chatSocket.off('conversation:presence', onPresence);
      chatSocket.off('messages:read', onRead);
      chatSocket.off('disconnect', onDisconnect);
    };
  }, [agent, refresh, toast]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const expiry = Date.now() - 45_000;
      setConversations((current) =>
        current.map((item) =>
          item.online && item.lastSeenAt && new Date(item.lastSeenAt).getTime() < expiry
            ? { ...item, online: false }
            : item,
        ),
      );
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const update = useCallback(async (id: string, changes: ConversationUpdate) => {
    const result = await apiRequest<Conversation>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    });
    setConversations((current) => current.map((item) => (item.id === id ? result : item)));
  }, []);

  const send = useCallback(
    (conversation: Conversation, text: string, attachment?: Attachment) => {
      if (!text.trim() && !attachment) return;
      const optimistic: Message = {
        id: `pending-${crypto.randomUUID()}`,
        conversationId: conversation.id,
        sender: 'agent',
        senderName: agent?.name || 'Agent',
        text: text.trim(),
        createdAt: new Date().toISOString(),
        attachmentName: attachment?.name,
        attachmentMime: attachment?.mime,
        attachmentUrl: attachment?.url,
        attachmentKey: attachment?.key,
        attachmentSize: attachment?.size,
      };
      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id ? { ...item, messages: [...item.messages, optimistic] } : item,
        ),
      );
      void ensureAccessToken()
        .then((token) => {
          connectAgentSocket(token);
          chatSocket.emit('join', { conversationId: conversation.id, role: 'agent' });
          chatSocket.emit('message', {
            conversationId: conversation.id,
            sender: 'agent',
            senderName: agent?.name,
            text: text.trim(),
            attachment,
          });
        })
        .catch((error) => toast.error(error instanceof Error ? error.message : 'Session expired'));
    },
    [agent, toast],
  );

  const join = useCallback(
    (id: string) => chatSocket.emit('join', { conversationId: id, role: 'agent' }),
    [],
  );
  const markRead = useCallback((id: string) => {
    chatSocket.emit('messages:read', { conversationId: id, reader: 'agent' });
  }, []);
  const setTyping = useCallback((id: string, typing: boolean) => {
    chatSocket.emit('typing', { conversationId: id, sender: 'agent', typing });
  }, []);

  const value = useMemo<ConversationContextValue>(
    () => ({
      conversations,
      loading,
      typingConversationId,
      conversationVersion,
      refresh,
      query,
      update,
      send,
      join,
      markRead,
      setTyping,
    }),
    [
      conversations,
      loading,
      typingConversationId,
      conversationVersion,
      refresh,
      query,
      update,
      send,
      join,
      markRead,
      setTyping,
    ],
  );

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export async function playNotificationSound() {
  try {
    const context = getNotificationAudioContext();
    if (!context) return false;
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return false;
    playTone(context, 660, 0, 0.16, 0.1);
    playTone(context, 880, 0.13, 0.2, 0.12);
    return true;
  } catch {
    return false;
  }
}

async function unlockNotificationAudio() {
  try {
    const context = getNotificationAudioContext();
    if (!context) return false;
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch {
    return false;
  }
}

function getNotificationAudioContext() {
  if (!notificationAudioContext && typeof AudioContext !== 'undefined') {
    notificationAudioContext = new AudioContext();
  }
  return notificationAudioContext;
}

function playTone(context: AudioContext, frequency: number, delay: number, duration: number, volume: number) {
  const start = context.currentTime + delay;
  const end = start + duration;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

export function useConversations() {
  const context = useContext(ConversationContext);
  if (!context) throw new Error('useConversations must be used inside ConversationsProvider');
  return context;
}
