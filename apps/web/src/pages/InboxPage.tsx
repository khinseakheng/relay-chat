import { useEffect, useMemo, useState } from 'react';
import { App } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatWindow } from '../components/ChatWindow';
import { ConversationList } from '../components/ConversationList';
import { VisitorDetails } from '../components/VisitorDetails';
import { useConversations } from '../hooks/useConversations';
import type { Conversation } from '../types';

export function InboxPage() {
  const { message } = App.useApp();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const {
    conversations,
    loading,
    conversationVersion,
    query: fetchConversations,
    update,
  } = useConversations();
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'Open' | 'All' | 'Closed'>('Open');
  const [newest, setNewest] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resultIds, setResultIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const active = conversations.find((item) => item.id === conversationId);
  const displayedConversations = useMemo(
    () =>
      resultIds
        .map((id) => conversations.find((conversation) => conversation.id === id))
        .filter((conversation): conversation is Conversation => Boolean(conversation))
        .filter((conversation) => status === 'All' || conversation.status === status.toLowerCase()),
    [conversations, resultIds, status],
  );

  useEffect(() => {
    if (status === 'All') return;
    const expectedStatus = status.toLowerCase();
    const hasRealtimeStatusChange = resultIds.some((id) => {
      const conversation = conversations.find((item) => item.id === id);
      return conversation && conversation.status !== expectedStatus;
    });
    if (hasRealtimeStatusChange) setReloadKey((value) => value + 1);
  }, [conversations, resultIds, status]);

  useEffect(() => {
    let current = true;
    setSearching(true);
    const timer = window.setTimeout(
      () => {
        fetchConversations({
          q: query.trim(),
          status: status.toLowerCase() as 'all' | 'open' | 'closed',
          sort: newest ? 'newest' : 'oldest',
          page: 1,
          limit: 30,
        })
          .then((result) => {
            if (!current) return;
            setResultIds(result.items.map((item) => item.id));
            setPage(1);
            setTotal(result.total);
            setHasMore(result.hasMore);
            setOpenCount(result.counts.open);
          })
          .catch((error: Error) => {
            if (current) {
              setResultIds([]);
              setTotal(0);
              setHasMore(false);
              message.error(error.message);
            }
          })
          .finally(() => {
            if (current) setSearching(false);
          });
      },
      query.trim() ? 300 : 0,
    );
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [conversationVersion, fetchConversations, message, newest, query, reloadKey, status]);

  useEffect(() => {
    if (
      displayedConversations.length &&
      (!conversationId || !displayedConversations.some((conversation) => conversation.id === conversationId))
    ) {
      const first = displayedConversations[0];
      navigate(`/inbox/${first.id}`, { replace: true });
    } else if (
      conversationId &&
      !displayedConversations.length &&
      !conversations.some(
        (conversation) =>
          conversation.id === conversationId &&
          (status === 'All' || conversation.status === status.toLowerCase()),
      )
    ) {
      navigate('/inbox', { replace: true });
    }
  }, [conversationId, conversations, displayedConversations, navigate, status]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchConversations({
        q: query.trim(),
        status: status.toLowerCase() as 'all' | 'open' | 'closed',
        sort: newest ? 'newest' : 'oldest',
        page: nextPage,
        limit: 30,
      });
      setResultIds((current) => [...new Set([...current, ...result.items.map((item) => item.id)])]);
      setPage(nextPage);
      setTotal(result.total);
      setHasMore(result.hasMore);
      setOpenCount(result.counts.open);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not load more conversations');
    } finally {
      setLoadingMore(false);
    }
  };

  const markAllRead = async () => {
    await Promise.all(
      conversations.filter((item) => item.unread).map((item) => update(item.id, { unread: 0 })),
    );
  };
  return (
    <div className="flex min-w-0 flex-1">
      <ConversationList
        conversations={displayedConversations}
        selectedId={conversationId}
        loading={loading || searching}
        loadingMore={loadingMore}
        hasMore={hasMore}
        total={total}
        openCount={openCount}
        query={query}
        status={status}
        newest={newest}
        onSelect={(id) => navigate(`/inbox/${id}`)}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onSortChange={() => setNewest((value) => !value)}
        onLoadMore={() => void loadMore()}
        onRefresh={() => setReloadKey((value) => value + 1)}
        onMarkAllRead={() => void markAllRead()}
      />
      <ChatWindow
        conversation={active}
        detailsOpen={detailsOpen}
        onToggleDetails={() => setDetailsOpen((value) => !value)}
      />
      {detailsOpen && active && (
        <VisitorDetails conversation={active} onClose={() => setDetailsOpen(false)} />
      )}
    </div>
  );
}
