import { Bell, MessageCircle, TrendingUp, UserCheck, Users } from 'lucide-react';
import { Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useConversations } from '../hooks/useConversations';
import { relativeTime } from '../lib/format';

export function DashboardPage() {
  const navigate = useNavigate();
  const { conversations } = useConversations();
  const open = conversations.filter((item) => item.status === 'open').length;
  const closed = conversations.length - open;
  const unread = conversations.reduce((total, item) => total + item.unread, 0);
  const contacts = new Set(conversations.map((item) => item.visitor.email || item.visitor.name)).size;
  const stats = [
    { label: 'Open conversations', value: open, note: 'Live workload', icon: MessageCircle },
    { label: 'Unread messages', value: unread, note: 'Needs attention', icon: Bell },
    { label: 'Total contacts', value: contacts, note: 'All visitors', icon: Users },
    {
      label: 'Resolution rate',
      value: `${conversations.length ? Math.round((closed / conversations.length) * 100) : 0}%`,
      note: 'Conversations closed',
      icon: UserCheck,
    },
  ];
  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="OVERVIEW"
          title="Dashboard"
          description="Here’s what is happening in your support workspace."
        />
        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, note, icon: Icon }) => (
            <article
              key={label}
              className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Icon className="absolute right-5 top-5 text-brand" size={20} />
              <p className="text-xs text-slate-500">{label}</p>
              <strong className="my-2 block text-3xl">{value}</strong>
              <small className="flex items-center gap-1 text-slate-400">
                <TrendingUp size={12} />
                {note}
              </small>
            </article>
          ))}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Recent conversations</h2>
              <p className="text-xs text-slate-500">Latest visitor activity</p>
            </div>
            <button className="text-sm font-semibold text-brand" onClick={() => navigate('/inbox')}>
              View inbox
            </button>
          </div>
          {conversations.slice(0, 6).map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-3 border-t border-slate-100 py-3 text-left hover:bg-slate-50"
              onClick={() => navigate(`/inbox/${item.id}`)}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-xs font-bold text-violet-700">
                {item.visitor.initials}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm">{item.visitor.name}</b>
                <small className="block truncate text-slate-400">
                  {item.messages.at(-1)?.text || 'New conversation'}
                </small>
              </span>
              <Tag color={item.status === 'open' ? 'green' : 'default'}>{item.status}</Tag>
              <time className="text-xs text-slate-400">
                {relativeTime(item.messages.at(-1)?.createdAt || item.startedAt)}
              </time>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
