import { useMemo, useState } from 'react';
import { Input, Tag } from 'antd';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { useConversations } from '../hooks/useConversations';

export function ContactsPage() {
  const navigate = useNavigate();
  const { conversations } = useConversations();
  const [query, setQuery] = useState('');
  const contacts = useMemo(
    () =>
      Array.from(
        new Map(conversations.map((item) => [item.visitor.email || item.visitor.name, item])).values(),
      ).filter((item) =>
        `${item.visitor.name} ${item.visitor.email}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [conversations, query],
  );
  return (
    <main className="flex-1 overflow-auto bg-slate-50 px-8 py-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="PEOPLE"
          title="Contacts"
          description="Visitors who have started a conversation with your team."
        />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{contacts.length} contacts</h2>
            <Input
              className="max-w-xs"
              prefix={<Search size={15} />}
              placeholder="Search contacts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {contacts.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-3 border-t border-slate-100 py-3 text-left hover:bg-slate-50"
              onClick={() => navigate(`/inbox/${item.id}`)}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100 text-xs font-bold text-cyan-700">
                {item.visitor.initials}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm">{item.visitor.name}</b>
                <small className="text-slate-400">{item.visitor.email || 'Anonymous visitor'}</small>
              </span>
              <span className="hidden text-xs text-slate-400 md:block">{item.visitor.location}</span>
              <Tag>{item.messages.length} messages</Tag>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
