import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import type { Cache } from 'cache-manager';
import { ConversationEntity } from './entities';
import { ChatRepository } from './chat.repository';
import { WorkspaceService } from '../workspace/workspace.service';
import type { WorkspaceRole } from '../workspace/workspace.entities';

@Injectable()
export class ChatService {
  constructor(
    private readonly repository: ChatRepository,
    private readonly workspace: WorkspaceService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async list(
    workspaceId: string,
    options: {
      q?: string;
      status?: 'all' | 'open' | 'closed';
      sort?: 'newest' | 'oldest';
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(options.page || 1, 1);
    const limit = Math.min(Math.max(options.limit || 30, 1), 50);
    const result = await this.repository.findPage(workspaceId, {
      search: options.q?.trim().slice(0, 200) || '',
      status: options.status || 'all',
      sort: options.sort || 'newest',
      page,
      limit,
    });
    const items = await this.withPresence(result.items.map((item) => this.toClient(item)));
    return {
      items,
      page,
      limit,
      total: result.total,
      hasMore: page * limit < result.total,
      counts: result.counts,
    };
  }

  private async withPresence(result: ReturnType<ChatService['toClient']>[]) {
    const ids = result.map((item) => item.id);
    const [presence, lastSeen] = await Promise.all([
      this.repository.presenceFor(ids),
      this.repository.lastSeenFor(ids),
    ]);
    return result.map((item) => ({
      ...item,
      online: presence.has(item.id),
      lastSeenAt: (presence.get(item.id) || lastSeen.get(item.id))?.toISOString() || null,
    }));
  }

  async get(id: string, workspaceId?: string) {
    const cacheKey = `conversation:${workspaceId || 'public'}:${id}`;
    const cached = await this.cache.get<ReturnType<ChatService['toClient']>>(cacheKey);
    let result = cached;
    if (!result) {
      const found = await this.repository.findOne(id, workspaceId);
      if (!found) throw new NotFoundException('Conversation not found');
      result = this.toClient(found);
      await this.cache.set(cacheKey, result, 10_000);
    }
    const [presence, lastSeen] = await Promise.all([
      this.repository.presenceFor([id]),
      this.repository.lastSeenFor([id]),
    ]);
    return {
      ...result,
      online: presence.has(id),
      lastSeenAt: (presence.get(id) || lastSeen.get(id))?.toISOString() || null,
    };
  }

  async create(
    siteId: string,
    name?: string,
    email = '',
    page = '/',
    initialMessage?: string,
    customFields: Record<string, string> = {},
    identity?: { externalUserId: string; metadata: Record<string, string> },
  ) {
    const widget = await this.workspace.widgetBySiteId(siteId);
    if (widget.preChatFields.name.enabled && widget.preChatFields.name.required && !name?.trim()) {
      throw new BadRequestException('Name is required');
    }
    if (widget.preChatFields.email.enabled && widget.preChatFields.email.required && !email.trim()) {
      throw new BadRequestException('Email is required');
    }
    const normalizedFields: Record<string, string> = {};
    for (const field of widget.customFields) {
      const value =
        typeof customFields[field.id] === 'string' ? customFields[field.id].trim().slice(0, 500) : '';
      if (field.required && !value) throw new BadRequestException(`${field.label} is required`);
      if (value && field.type === 'email' && !isEmail(value)) {
        throw new BadRequestException(`${field.label} must be a valid email address`);
      }
      if (value && field.type === 'select' && !field.options.includes(value)) {
        throw new BadRequestException(`${field.label} has an invalid value`);
      }
      if (value) normalizedFields[field.label] = value;
    }
    const visitorName = name?.trim() || 'Website visitor';
    const initials =
      visitorName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'V';
    const existing = identity
      ? await this.repository.findLatestForExternalUser(widget.workspaceId, siteId, identity.externalUserId)
      : null;
    let created: ConversationEntity;
    if (existing) {
      await this.repository.update(existing.id, {
        visitorName,
        visitorEmail: email,
        visitorInitials: initials,
        page,
        customFields: { ...(existing.customFields || {}), ...normalizedFields, ...identity!.metadata },
      });
      await this.invalidate(existing.id, widget.workspaceId);
      created = existing;
    } else {
      created = await this.repository.saveConversation({
        siteId,
        workspaceId: widget.workspaceId,
        externalUserId: identity?.externalUserId,
        authenticated: Boolean(identity),
        visitorName,
        visitorEmail: email,
        visitorInitials: initials,
        page,
        customFields: identity ? { ...normalizedFields, ...identity.metadata } : normalizedFields,
      });
    }
    if (initialMessage?.trim()) {
      await this.addMessage(created.id, 'visitor', initialMessage.trim());
    } else {
      await this.cache.del(`conversations:${widget.workspaceId}`);
    }
    return this.get(created.id);
  }

  async updateVisitor(id: string, profile: { name: string; email?: string }) {
    const existing = await this.repository.findRaw(id);
    if (!existing) throw new NotFoundException('Conversation not found');
    if (existing.authenticated)
      throw new ForbiddenException('Authenticated visitor identity cannot be edited');
    const initials =
      profile.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'V';
    await this.repository.update(id, {
      visitorName: profile.name,
      visitorEmail: profile.email || '',
      visitorInitials: initials,
    });
    await this.invalidate(id, existing.workspaceId);
    return this.get(id);
  }

  async addMessage(
    conversationId: string,
    sender: 'visitor' | 'agent',
    text: string,
    senderName?: string,
    attachment?: { name: string; mime: string; url: string; key?: string; size?: number },
    workspaceId?: string,
    senderUserId?: string,
  ) {
    const raw = await this.repository.findRaw(conversationId, workspaceId);
    if (!raw) throw new NotFoundException('Conversation not found');
    const message = await this.repository.saveMessage({
      conversationId,
      sender,
      senderName: senderName || (sender === 'agent' ? 'Alex Morgan' : raw.visitorName),
      senderUserId,
      text,
      attachmentName: attachment?.name,
      attachmentMime: attachment?.mime,
      attachmentUrl: attachment?.url,
      attachmentKey: attachment?.key,
      attachmentSize: attachment?.size,
    });
    if (sender === 'visitor') {
      await this.repository.incrementUnread(conversationId);
      if (raw.status === 'closed') await this.repository.update(conversationId, { status: 'open' });
    }
    await this.invalidate(conversationId, raw.workspaceId);
    return message;
  }

  async unsendAgentMessage(
    conversationId: string,
    messageId: string,
    workspaceId: string,
    actorUserId: string,
    actorRole: WorkspaceRole,
  ) {
    const conversation = await this.repository.findRaw(conversationId, workspaceId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    const message = await this.repository.findMessage(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw new NotFoundException('Message not found');
    }
    if (message.sender !== 'agent') {
      throw new ForbiddenException('Visitor messages can only be unsent by the visitor');
    }
    if (
      message.senderUserId &&
      message.senderUserId !== actorUserId &&
      !['owner', 'admin'].includes(actorRole)
    ) {
      throw new ForbiddenException('You can only unsend your own messages');
    }
    return this.unsendMessage(conversationId, messageId, conversation.workspaceId);
  }

  async unsendVisitorMessage(conversationId: string, messageId: string) {
    const conversation = await this.repository.findRaw(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    const message = await this.repository.findMessage(messageId);
    if (!message || message.conversationId !== conversationId || message.sender !== 'visitor') {
      throw new NotFoundException('Visitor message not found');
    }
    return this.unsendMessage(conversationId, messageId, conversation.workspaceId);
  }

  private async unsendMessage(conversationId: string, messageId: string, workspaceId?: string) {
    const message = await this.repository.findMessage(messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (!message.deletedAt) {
      message.deletedAt = new Date();
      await this.repository.unsendMessage(message.id, message.deletedAt);
      await this.invalidate(conversationId, workspaceId);
    }
    return {
      event: {
        conversationId,
        messageId,
        deletedAt: message.deletedAt.toISOString(),
      },
      conversation: await this.get(conversationId, workspaceId),
    };
  }

  async update(
    id: string,
    workspaceId: string,
    update: Partial<Pick<ConversationEntity, 'status' | 'unread' | 'visitorName' | 'visitorEmail'>> & {
      assignedMemberId?: string | null;
      tags?: string[];
      notes?: { id: string; text: string; author: string; createdAt: string }[];
    },
  ) {
    const existing = await this.repository.findRaw(id, workspaceId);
    if (!existing) {
      throw new NotFoundException('Conversation not found');
    }
    if (update.status === 'open' && existing.status === 'closed' && existing.assignedMemberId) {
      const widget = await this.workspace.widgetBySiteId(existing.siteId);
      if (widget.maxActiveConversationsPerAgent > 0) {
        const assigned = await this.repository.countOpenAssigned(existing.assignedMemberId, id);
        if (assigned >= widget.maxActiveConversationsPerAgent) {
          throw new ConflictException(
            `${existing.assignedTo} has reached the ${widget.maxActiveConversationsPerAgent} active-conversation limit`,
          );
        }
      }
    }
    const { tags, notes, assignedMemberId, ...conversationUpdate } = update;
    if (Object.prototype.hasOwnProperty.call(update, 'assignedMemberId')) {
      if (assignedMemberId) {
        const member = await this.workspace.assignmentMember(workspaceId, assignedMemberId);
        if (!member) throw new NotFoundException('Assignable workspace member not found');
        const widget = await this.workspace.widgetBySiteId(existing.siteId);
        if (existing.status === 'open' && widget.maxActiveConversationsPerAgent > 0) {
          const assigned = await this.repository.countOpenAssigned(member.id, id);
          if (assigned >= widget.maxActiveConversationsPerAgent) {
            throw new ConflictException(
              `${member.name} has reached the ${widget.maxActiveConversationsPerAgent} active-conversation limit`,
            );
          }
        }
        Object.assign(conversationUpdate, {
          assignedMemberId: member.id,
          assignedTo: member.name,
        });
      } else {
        Object.assign(conversationUpdate, { assignedMemberId: null, assignedTo: 'Unassigned' });
      }
    }
    if (Object.keys(conversationUpdate).length) await this.repository.update(id, conversationUpdate);
    if (tags) await this.repository.replaceTags(id, [...new Set(tags)]);
    if (notes) await this.repository.replaceNotes(id, notes);
    await this.invalidate(id, workspaceId);
    return this.get(id, workspaceId);
  }

  stats(workspaceId: string) {
    return this.repository.stats(workspaceId);
  }

  async closeInactive(inactiveForMs: number) {
    const closed = await this.repository.closeInactive(new Date(Date.now() - inactiveForMs));
    return Promise.all(
      closed.map(async (conversation) => {
        await this.invalidate(conversation.id, conversation.workspaceId);
        return this.get(conversation.id, conversation.workspaceId);
      }),
    );
  }

  async touchPresence(conversationId: string, socketId: string) {
    await this.get(conversationId);
    const lastSeenAt = await this.repository.touchPresence(conversationId, socketId);
    return { conversationId, online: true, lastSeenAt: lastSeenAt.toISOString() };
  }

  async removePresence(conversationId: string, socketId: string) {
    const disconnectedAt = await this.repository.removePresence(conversationId, socketId);
    const presence = await this.repository.presenceFor([conversationId]);
    return {
      conversationId,
      online: presence.has(conversationId),
      lastSeenAt: presence.get(conversationId)?.toISOString() || disconnectedAt.toISOString(),
    };
  }

  async markRead(conversationId: string, reader: 'visitor' | 'agent', workspaceId?: string) {
    if (workspaceId && !(await this.repository.findRaw(conversationId, workspaceId))) {
      throw new NotFoundException('Conversation not found');
    }
    const readAt = await this.repository.markMessagesRead(conversationId, reader);
    const conversation = await this.repository.findRaw(conversationId);
    await this.invalidate(conversationId, conversation?.workspaceId);
    return { conversationId, reader, readAt: readAt.toISOString() };
  }

  private async invalidate(id: string, workspaceId?: string) {
    await Promise.all([
      workspaceId ? this.cache.del(`conversations:${workspaceId}`) : Promise.resolve(),
      workspaceId ? this.cache.del(`conversation:${workspaceId}:${id}`) : Promise.resolve(),
      this.cache.del(`conversation:public:${id}`),
    ]);
  }

  private toClient(conversation: ConversationEntity) {
    return {
      id: conversation.id,
      workspaceId: conversation.workspaceId,
      siteId: conversation.siteId,
      visitor: {
        name: conversation.visitorName,
        email: conversation.visitorEmail,
        location: conversation.visitorLocation,
        browser: conversation.visitorBrowser,
        initials: conversation.visitorInitials,
        customFields: conversation.customFields || {},
        authenticated: conversation.authenticated,
        externalUserId: conversation.externalUserId || null,
      },
      status: conversation.status,
      unread: conversation.unread,
      assignedTo: conversation.assignedMemberId ? conversation.assignedTo : 'Unassigned',
      assignedMemberId: conversation.assignedMemberId || null,
      page: conversation.page,
      tags: (conversation.tagEntities || []).map((tag) => tag.name),
      notes: (conversation.noteEntities || []).map((note) => ({
        id: note.id,
        text: note.text,
        author: note.author,
        createdAt: note.createdAt.toISOString(),
      })),
      startedAt: conversation.startedAt.toISOString(),
      firstSeenAt: conversation.startedAt.toISOString(),
      messages: (conversation.messages || []).map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        sender: message.sender,
        senderName: message.senderName,
        senderUserId: message.senderUserId,
        text: message.deletedAt ? '' : message.text,
        attachmentName: message.deletedAt ? undefined : message.attachmentName,
        attachmentMime: message.deletedAt ? undefined : message.attachmentMime,
        attachmentUrl: message.deletedAt ? undefined : message.attachmentUrl,
        attachmentKey: message.deletedAt ? undefined : message.attachmentKey,
        attachmentSize: message.deletedAt ? undefined : message.attachmentSize,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString(),
        deletedAt: message.deletedAt?.toISOString(),
      })),
    };
  }
}
