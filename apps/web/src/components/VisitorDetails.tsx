import { useState } from 'react';
import { Input, Modal, Tag } from 'antd';
import { X } from 'lucide-react';
import type { Conversation } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useConversations } from '../hooks/useConversations';
import { formatDateTime, relativeTimeAgo } from '../lib/format';

export function VisitorDetails({ conversation, onClose }: { conversation: Conversation; onClose(): void }) {
  const { agent } = useAuth();
  const canEdit = agent?.role !== 'viewer';
  const { update } = useConversations();
  const [tagModal, setTagModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const addTag = () => {
    const value = tag.trim().toLowerCase();
    if (value && !conversation.tags.includes(value))
      void update(conversation.id, { tags: [...conversation.tags, value] });
    setTag('');
    setTagModal(false);
  };
  const addNote = () => {
    if (note.trim())
      void update(conversation.id, {
        notes: [
          ...conversation.notes,
          {
            id: crypto.randomUUID(),
            text: note.trim(),
            createdAt: new Date().toISOString(),
            author: agent?.name || 'Agent',
          },
        ],
      });
    setNote('');
    setNoteModal(false);
  };

  return (
    <aside className="hidden w-[290px] shrink-0 overflow-auto border-l border-slate-200 bg-slate-50 xl:block">
      <header className="relative border-b border-slate-200 px-5 py-6 text-center">
        <button className="absolute right-4 top-4 text-slate-400" onClick={onClose}>
          <X size={16} />
        </button>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-100 font-bold text-violet-700">
          {conversation.visitor.initials}
        </span>
        <h2 className="mt-3 font-bold">{conversation.visitor.name}</h2>
        <p className="text-xs text-slate-400">{conversation.visitor.email || 'No email provided'}</p>
        <Tag className="mt-2" color={conversation.online ? 'green' : 'default'}>
          ●{' '}
          {conversation.online
            ? 'Online'
            : conversation.lastSeenAt
              ? `Last seen ${relativeTimeAgo(conversation.lastSeenAt)}`
              : 'Offline'}
        </Tag>
      </header>
      <DetailSection title="Visitor details">
        <Detail label="Location" value={conversation.visitor.location} />
        <Detail label="Browser" value={conversation.visitor.browser} />
        <Detail label="Current page" value={conversation.page} />
        <Detail label="First seen" value={formatDateTime(conversation.firstSeenAt)} />
        <Detail
          label="Last seen"
          value={
            conversation.online
              ? 'Online now'
              : conversation.lastSeenAt
                ? formatDateTime(conversation.lastSeenAt)
                : 'Not recorded yet'
          }
        />
      </DetailSection>
      {Object.keys(conversation.visitor.customFields || {}).length > 0 && (
        <DetailSection title="Pre-chat details">
          {Object.entries(conversation.visitor.customFields).map(([label, value]) => (
            <Detail key={label} label={label} value={value} />
          ))}
        </DetailSection>
      )}
      <DetailSection
        title="Tags"
        action={
          canEdit ? (
            <button className="text-brand" onClick={() => setTagModal(true)}>
              + Add
            </button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap gap-1">
          {conversation.tags.length ? (
            conversation.tags.map((item) => (
              <Tag
                key={item}
                closable={canEdit}
                onClose={() =>
                  update(conversation.id, { tags: conversation.tags.filter((value) => value !== item) })
                }
              >
                {item}
              </Tag>
            ))
          ) : (
            <span className="text-xs text-slate-400">No tags yet</span>
          )}
        </div>
      </DetailSection>
      <DetailSection title="Conversation">
        <Detail label="Assigned to" value={conversation.assignedTo} />
        <Detail label="Status" value={conversation.status} />
      </DetailSection>
      <DetailSection
        title="Private notes"
        action={
          canEdit ? (
            <button className="text-brand" onClick={() => setNoteModal(true)}>
              + Add
            </button>
          ) : undefined
        }
      >
        {conversation.notes.map((item) => (
          <div className="mb-2 rounded-lg bg-slate-100 p-2.5" key={item.id}>
            <p className="text-xs leading-relaxed">{item.text}</p>
            <small className="text-[9px] text-slate-400">
              {item.author} · {relativeTimeAgo(item.createdAt)}
            </small>
          </div>
        ))}
      </DetailSection>
      <Modal title="Add tag" open={tagModal} onCancel={() => setTagModal(false)} onOk={addTag}>
        <Input
          autoFocus
          maxLength={40}
          value={tag}
          placeholder="e.g. qualified lead"
          onChange={(event) => setTag(event.target.value)}
          onPressEnter={addTag}
        />
      </Modal>
      <Modal title="Add private note" open={noteModal} onCancel={() => setNoteModal(false)} onOk={addNote}>
        <Input.TextArea
          autoFocus
          maxLength={1000}
          rows={4}
          value={note}
          placeholder="Only your team can see this"
          onChange={(event) => setNote(event.target.value)}
        />
      </Modal>
    </aside>
  );
}

function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
        <span className="text-xs">{action}</span>
      </div>
      {children}
    </section>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="my-2.5 flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="truncate text-right capitalize text-slate-600">{value}</span>
    </div>
  );
}
