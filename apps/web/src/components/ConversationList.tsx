import { Button, Dropdown, Segmented, Skeleton } from 'antd';
import { Bell, ChevronDown, MoreHorizontal, RefreshCw, Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Conversation } from '../types';
import { relativeTime } from '../lib/format';

type Props = {
  conversations: Conversation[];
  selectedId?: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  openCount: number;
  query: string;
  status: 'Open' | 'All' | 'Closed';
  newest: boolean;
  onSelect(id: string): void;
  onQueryChange(query: string): void;
  onStatusChange(status: 'Open' | 'All' | 'Closed'): void;
  onSortChange(): void;
  onLoadMore(): void;
  onRefresh(): void;
  onMarkAllRead(): void;
};

export function ConversationList({
  conversations,
  selectedId,
  loading,
  loadingMore,
  hasMore,
  total,
  openCount,
  query,
  status,
  newest,
  onSelect,
  onQueryChange,
  onStatusChange,
  onSortChange,
  onLoadMore,
  onRefresh,
  onMarkAllRead,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const unread = conversations.reduce((total, item) => total + item.unread, 0);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 xl:w-[340px]">
      <header className="flex h-24 items-center justify-between px-5">
        <div>
          <span className="text-[10px] font-bold tracking-[.14em] text-slate-400">WORKSPACE</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Inbox</h1>
        </div>
        <Dropdown
          menu={{
            items: [
              { key: 'refresh', label: 'Refresh inbox', icon: <RefreshCw size={14} />, onClick: onRefresh },
              { key: 'read', label: 'Mark all as read', onClick: onMarkAllRead },
            ],
          }}
        >
          <Button type="text" shape="circle" icon={<MoreHorizontal size={20} />} />
        </Dropdown>
      </header>
      <div className="mx-4 flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 shadow-sm">
        <Search size={16} />
        <input
          ref={searchRef}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none"
          placeholder="Search name, message, or ID"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px]">⌘ K</kbd>
      </div>
      <div className="px-4 py-4">
        <Segmented
          className="w-full"
          block
          options={[
            {
              label: (
                <>
                  Open <b className="ml-1 rounded-full bg-slate-200 px-1.5 text-[10px]">{openCount}</b>
                </>
              ),
              value: 'Open',
            },
            'All',
            'Closed',
          ]}
          value={status}
          onChange={(value) => onStatusChange(value as typeof status)}
        />
      </div>
      <div className="flex items-center justify-between px-5 pb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <span>{total} conversations</span>
        <button className="flex items-center gap-1" onClick={onSortChange}>
          {newest ? 'Newest' : 'Oldest'}
          <ChevronDown size={12} />
        </button>
      </div>
      <div
        className="flex-1 overflow-auto px-2"
        onScroll={(event) => {
          const target = event.currentTarget;
          if (hasMore && !loadingMore && target.scrollHeight - target.scrollTop - target.clientHeight < 120) {
            onLoadMore();
          }
        }}
      >
        {loading ? (
          <div className="space-y-4 p-3">
            <Skeleton active avatar paragraph={{ rows: 1 }} />
            <Skeleton active avatar paragraph={{ rows: 1 }} />
            <Skeleton active avatar paragraph={{ rows: 1 }} />
          </div>
        ) : (
          conversations.map((item) => {
            const last = item.messages.at(-1);
            return (
              <button
                key={item.id}
                className={`flex w-full gap-3 rounded-xl p-3 text-left transition ${selectedId === item.id ? 'bg-violet-100' : 'hover:bg-slate-100'}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-xs font-bold text-violet-700">
                  {item.visitor.initials}
                  <i
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${item.online ? 'bg-emerald-400' : 'bg-slate-300'}`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <b className="truncate text-sm">{item.visitor.name}</b>
                    <time className="text-[10px] text-slate-400">
                      {relativeTime(last?.createdAt || item.startedAt)}
                    </time>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <small className="min-w-0 flex-1 truncate text-xs text-slate-500">
                      {last?.sender === 'agent' ? 'You: ' : ''}
                      {last?.text || last?.attachmentName || 'New conversation'}
                    </small>
                    {item.unread > 0 && (
                      <i className="grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] not-italic text-white">
                        {item.unread}
                      </i>
                    )}
                  </span>
                </span>
              </button>
            );
          })
        )}
        {loadingMore && <p className="py-4 text-center text-xs text-slate-400">Loading more…</p>}
      </div>
      <footer className="flex h-12 items-center justify-between border-t border-slate-200 px-5 text-[11px] text-slate-500">
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full bg-emerald-400" />
          All systems operational
        </span>
        <span title={`${unread} unread messages`}>
          <Bell size={16} />
          <span className="sr-only">{unread} unread</span>
        </span>
      </footer>
    </aside>
  );
}
