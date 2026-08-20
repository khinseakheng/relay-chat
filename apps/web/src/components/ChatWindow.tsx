import { useEffect, useRef, useState } from 'react';
import { App, Button, Dropdown, Empty, Input, Popconfirm, Tooltip } from 'antd';
import {
  Archive,
  ChevronDown,
  Ellipsis,
  Inbox,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import type { AttachmentCategory, AttachmentPolicy, Conversation, StoredFile } from '../types';
import { useConversations } from '../hooks/useConversations';
import { formatTime, relativeTimeAgo } from '../lib/format';
import { apiRequest } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const DEFAULT_ATTACHMENT_POLICY: AttachmentPolicy = {
  maxSizeMb: 5,
  allowedTypes: ['images', 'pdf', 'documents', 'spreadsheets', 'archives', 'text'],
};
type WorkspaceMember = {
  id: string;
  userId: string;
  name: string;
  role: 'owner' | 'admin' | 'agent' | 'viewer';
};

export function ChatWindow({
  conversation,
  detailsOpen,
  onToggleDetails,
}: {
  conversation?: Conversation;
  detailsOpen: boolean;
  onToggleDetails(): void;
}) {
  const { message: toast } = App.useApp();
  const { agent } = useAuth();
  const canReply = agent?.role !== 'viewer';
  const { send, update, join, markRead, setTyping, typingConversationId } = useConversations();
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [attachmentPolicy, setAttachmentPolicy] = useState(DEFAULT_ATTACHMENT_POLICY);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const conversationId = conversation?.id;

  useEffect(() => {
    if (!conversationId) return;
    join(conversationId);
    markRead(conversationId);
  }, [conversationId, join, markRead]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages.length]);
  useEffect(() => {
    if (!agent?.workspaceId) return;
    Promise.all([
      apiRequest<WorkspaceMember[]>('/workspace/members'),
      apiRequest<AttachmentPolicy>('/workspace/attachment-policy'),
    ])
      .then(([items, policy]) => {
        setMembers(items.filter((item) => item.role !== 'viewer'));
        setAttachmentPolicy(policy);
      })
      .catch((error: Error) => toast.error(error.message));
  }, [agent?.workspaceId, toast]);

  if (!conversation)
    return (
      <main className="grid flex-1 place-items-center">
        <Empty description="Select a conversation" />
      </main>
    );

  const presenceLabel = conversation.online
    ? 'Online now'
    : conversation.lastSeenAt
      ? `Last seen ${relativeTimeAgo(conversation.lastSeenAt)}`
      : 'Offline';

  const submit = () => {
    if (!canReply) return;
    send(conversation, draft);
    setDraft('');
    setTyping(conversation.id, false);
  };
  const changeDraft = (value: string) => {
    setDraft(value);
    setTyping(conversation.id, true);
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(conversation.id, false), 700);
  };
  const attach = async (file?: File) => {
    if (!file) return;
    if (file.size > attachmentPolicy.maxSizeMb * 1_024 * 1_024) {
      return toast.error(`Attachments must be ${attachmentPolicy.maxSizeMb} MB or smaller`);
    }
    if (!attachmentPolicy.allowedTypes.includes(attachmentCategory(file.type))) {
      return toast.error('This attachment type is disabled for the workspace');
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const stored = await apiRequest<StoredFile>(`/conversations/${conversation.id}/attachments`, {
        method: 'POST',
        body: form,
      });
      send(conversation, draft, stored);
      setDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'File upload failed');
    } finally {
      setUploading(false);
    }
  };
  const unsend = async (messageId: string) => {
    try {
      await apiRequest(`/conversations/${conversation.id}/messages/${messageId}`, {
        method: 'DELETE',
      });
      toast.success('Message unsent');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not unsend message');
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-white">
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-xs font-bold text-violet-700">
            {conversation.visitor.initials}
            <i
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${conversation.online ? 'bg-emerald-400' : 'bg-slate-300'}`}
            />
          </span>
          <span className="min-w-0">
            <h2 className="truncate text-sm font-bold">{conversation.visitor.name}</h2>
            <p className="truncate text-[11px] text-slate-400">
              <i
                className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${conversation.online ? 'bg-emerald-400' : 'bg-slate-300'}`}
              />
              {presenceLabel} · {conversation.page}
            </p>
          </span>
        </div>
        <div className="flex gap-2">
          <Dropdown
            disabled={!canReply}
            menu={{
              selectable: true,
              selectedKeys: [conversation.assignedMemberId || 'unassigned'],
              items: [
                {
                  key: 'unassigned',
                  label: 'Unassigned',
                  onClick: () =>
                    update(conversation.id, { assignedMemberId: null }).catch((error: Error) =>
                      toast.error(error.message),
                    ),
                },
                ...members.map((member) => ({
                  key: member.id,
                  label: `${member.name}${member.userId === agent?.id ? ' (You)' : ''}`,
                  onClick: () =>
                    update(conversation.id, { assignedMemberId: member.id }).catch((error: Error) =>
                      toast.error(error.message),
                    ),
                })),
              ],
            }}
          >
            <Button className="hidden xl:flex">
              {conversation.assignedTo}
              <ChevronDown size={14} />
            </Button>
          </Dropdown>
          <Tooltip title={conversation.status === 'open' ? 'Close' : 'Reopen'}>
            <Button
              disabled={!canReply}
              icon={conversation.status === 'open' ? <Archive size={16} /> : <Inbox size={16} />}
              onClick={() =>
                update(conversation.id, { status: conversation.status === 'open' ? 'closed' : 'open' })
              }
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'copy',
                  label: 'Copy conversation ID',
                  onClick: () =>
                    navigator.clipboard.writeText(conversation.id).then(() => toast.success('ID copied')),
                },
              ],
            }}
          >
            <Button icon={<Ellipsis size={16} />} />
          </Dropdown>
          <Button icon={detailsOpen ? <X size={16} /> : <Users size={16} />} onClick={onToggleDetails} />
        </div>
      </header>
      <section className="flex-1 overflow-auto bg-gradient-to-b from-white to-slate-50 px-[clamp(28px,6vw,76px)] py-5">
        <div className="mb-6 flex items-center gap-3 text-[10px] text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
          Today
        </div>
        {conversation.messages.map((item, index) => {
          const mine = item.sender === 'agent';
          const canUnsend =
            mine &&
            !item.deletedAt &&
            !item.id.startsWith('pending-') &&
            (!item.senderUserId ||
              item.senderUserId === agent?.id ||
              agent?.role === 'owner' ||
              agent?.role === 'admin');
          return (
            <div
              key={`${item.id}-${index}`}
              className={`my-3 flex items-end gap-2 ${mine ? 'justify-end' : ''}`}
            >
              {!mine && (
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-100 text-[9px] font-bold text-violet-700">
                  {conversation.visitor.initials}
                </span>
              )}
              <span className={`max-w-[70%] ${mine ? 'text-right' : ''}`}>
                <span
                  className={`inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed ${item.deletedAt ? 'border border-dashed border-slate-300 bg-transparent italic text-slate-400' : mine ? 'rounded-br-md bg-brand text-white shadow-lg shadow-violet-500/10' : 'rounded-tl-md bg-slate-100 text-slate-700'}`}
                >
                  {item.deletedAt ? 'Message unsent' : item.text}
                  {!item.deletedAt && (item.attachmentUrl || item.attachmentData) && (
                    <a
                      className={`mt-2 flex items-center gap-2 rounded-lg border p-2 text-xs ${mine ? 'border-white/20 text-white' : 'border-slate-200 text-slate-700'}`}
                      href={item.attachmentUrl || item.attachmentData}
                      download={item.attachmentName}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.attachmentMime?.startsWith('image/') ? (
                        <img
                          className="max-h-32 max-w-48 rounded"
                          src={item.attachmentUrl || item.attachmentData}
                          alt={item.attachmentName}
                        />
                      ) : (
                        <Paperclip size={15} />
                      )}
                      <span>{item.attachmentName}</span>
                    </a>
                  )}
                </span>
                <small className="mt-1 block text-[9px] text-slate-400">
                  {mine ? 'You' : item.senderName} · {formatTime(item.createdAt)}
                  {mine && !item.deletedAt && (item.readAt ? ' · ✓✓ Seen' : ' · ✓ Delivered')}
                  {canUnsend && (
                    <Popconfirm
                      title="Unsend this message?"
                      description="It will be replaced by an unsent-message placeholder for everyone."
                      okText="Unsend"
                      onConfirm={() => void unsend(item.id)}
                    >
                      <button className="ml-2 inline-flex items-center gap-1 hover:text-brand">
                        <Undo2 size={10} /> Unsend
                      </button>
                    </Popconfirm>
                  )}
                </small>
              </span>
            </div>
          );
        })}
        {typingConversationId === conversation.id && (
          <p className="pl-9 text-[10px] text-slate-400">••• {conversation.visitor.name} is typing</p>
        )}
        <div ref={endRef} />
      </section>
      <section className="m-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <Input.TextArea
          bordered={false}
          autoSize={{ minRows: 2, maxRows: 5 }}
          className="p-3 text-sm"
          value={draft}
          disabled={!canReply}
          placeholder={`Reply to ${conversation.visitor.name}…`}
          onChange={(event) => changeDraft(event.target.value)}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept={attachmentAccept(attachmentPolicy.allowedTypes)}
          hidden
          onChange={(event) => {
            attach(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1 text-slate-400">
            <Tooltip
              title={
                attachmentPolicy.allowedTypes.length
                  ? `Attach file (max ${attachmentPolicy.maxSizeMb} MB)`
                  : 'Attachments are disabled for this workspace'
              }
            >
              <button
                disabled={uploading || !canReply || !attachmentPolicy.allowedTypes.length}
                className="p-1.5 hover:text-brand disabled:opacity-40"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={16} />
              </button>
            </Tooltip>
            <Dropdown
              menu={{
                items: ['👋', '😊', '👍', '🎉', '❤️'].map((emoji) => ({
                  key: emoji,
                  label: emoji,
                  onClick: () => setDraft((value) => value + emoji),
                })),
              }}
            >
              <button className="p-1.5 hover:text-brand">
                <Smile size={16} />
              </button>
            </Dropdown>
            <Tooltip title="Quick reply">
              <button
                className="p-1.5 hover:text-brand"
                onClick={() => setDraft('Thanks for reaching out! I’m checking that for you now.')}
              >
                <Sparkles size={16} />
              </button>
            </Tooltip>
            <span className="ml-2 text-[10px]">Enter to send</span>
          </div>
          <Button
            disabled={!canReply}
            type="primary"
            icon={<Send size={14} />}
            loading={uploading}
            onClick={submit}
          >
            {canReply ? 'Send' : 'Read only'}
          </Button>
        </div>
      </section>
    </main>
  );
}

function attachmentCategory(mime: string): AttachmentCategory {
  if (mime.startsWith('image/')) return 'images';
  if (mime === 'application/pdf') return 'pdf';
  if (
    [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(mime)
  )
    return 'documents';
  if (
    [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(mime)
  )
    return 'spreadsheets';
  if (mime === 'application/zip') return 'archives';
  return 'text';
}

function attachmentAccept(types: AttachmentCategory[]) {
  const values: Record<AttachmentCategory, string[]> = {
    images: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'],
    pdf: ['application/pdf'],
    documents: ['.doc', '.docx'],
    spreadsheets: ['.xls', '.xlsx'],
    archives: ['.zip'],
    text: ['.txt', '.csv'],
  };
  return types.flatMap((type) => values[type]).join(',');
}
