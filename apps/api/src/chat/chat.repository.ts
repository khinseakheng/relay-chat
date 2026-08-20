import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import {
  ConversationEntity,
  ConversationNoteEntity,
  ConversationTagEntity,
  MessageEntity,
  PresenceSessionEntity,
} from './entities';

@Injectable()
export class ChatRepository {
  constructor(
    @InjectRepository(ConversationEntity) private readonly conversations: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity) private readonly messages: Repository<MessageEntity>,
    @InjectRepository(PresenceSessionEntity) private readonly presence: Repository<PresenceSessionEntity>,
    @InjectRepository(ConversationTagEntity) private readonly tags: Repository<ConversationTagEntity>,
    @InjectRepository(ConversationNoteEntity) private readonly notes: Repository<ConversationNoteEntity>,
  ) {}
  async findPage(
    workspaceId: string,
    options: {
      search: string;
      status: 'all' | 'open' | 'closed';
      sort: 'newest' | 'oldest';
      page: number;
      limit: number;
    },
  ) {
    const query = this.listQuery(workspaceId, options.search);
    if (options.status !== 'all') {
      query.andWhere('conversation.status = :status', { status: options.status });
    }
    const direction = options.sort === 'newest' ? 'DESC' : 'ASC';
    const activityExpression = `COALESCE(
      (SELECT MAX("activity"."createdAt")
       FROM "messages" "activity"
       WHERE "activity"."conversationId" = "conversation"."id"),
      "conversation"."startedAt"
    )`;
    query
      .addSelect(activityExpression, 'conversation_activity_at')
      .orderBy('conversation_activity_at', direction)
      .addOrderBy('conversation.id', direction)
      .addOrderBy('message.createdAt', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);

    const [items, total] = await query.getManyAndCount();
    const count = (status: 'open' | 'closed') => {
      const countQuery = this.listQuery(workspaceId, options.search);
      countQuery.andWhere('conversation.status = :countStatus', { countStatus: status });
      return countQuery.getCount();
    };
    const [open, closed] = await Promise.all([count('open'), count('closed')]);
    return { items, total, counts: { all: open + closed, open, closed } };
  }

  private listQuery(workspaceId: string, search: string) {
    const query = this.conversations
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'message')
      .leftJoinAndSelect('conversation.tagEntities', 'tag')
      .leftJoinAndSelect('conversation.noteEntities', 'note')
      .where('conversation.workspaceId = :workspaceId', { workspaceId });
    if (search) {
      query.andWhere(
        `(CAST(conversation.id AS text) ILIKE :search
          OR conversation.siteId ILIKE :search
          OR conversation.visitorName ILIKE :search
          OR conversation.visitorEmail ILIKE :search
          OR conversation.externalUserId ILIKE :search
          OR conversation.visitorLocation ILIKE :search
          OR conversation.visitorBrowser ILIKE :search
          OR conversation.page ILIKE :search
          OR conversation.assignedTo ILIKE :search
          OR message.text ILIKE :search
          OR message.attachmentName ILIKE :search
          OR tag.name ILIKE :search
          OR note.text ILIKE :search)`,
        { search: `%${search}%` },
      );
    }
    return query;
  }
  findOne(id: string, workspaceId?: string) {
    return this.conversations.findOne({
      where: workspaceId ? { id, workspaceId } : { id },
      relations: { messages: true, tagEntities: true, noteEntities: true },
      order: { messages: { createdAt: 'ASC' } },
    });
  }
  findRaw(id: string, workspaceId?: string) {
    return this.conversations.findOneBy(workspaceId ? { id, workspaceId } : { id });
  }
  findLatestForExternalUser(workspaceId: string, siteId: string, externalUserId: string) {
    return this.conversations.findOne({
      where: { workspaceId, siteId, externalUserId, authenticated: true },
      order: { startedAt: 'DESC' },
    });
  }
  saveConversation(value: Partial<ConversationEntity>) {
    return this.conversations.save(this.conversations.create(value));
  }
  saveMessage(value: Partial<MessageEntity>) {
    return this.messages.save(this.messages.create(value));
  }
  findMessage(id: string) {
    return this.messages.findOneBy({ id });
  }
  unsendMessage(id: string, deletedAt: Date) {
    return this.messages.update(id, {
      deletedAt,
      text: '',
      attachmentName: null,
      attachmentMime: null,
      attachmentData: null,
      attachmentUrl: null,
      attachmentKey: null,
      attachmentSize: null,
    });
  }
  update(id: string, value: Partial<ConversationEntity>) {
    return this.conversations.update(id, value);
  }
  async closeInactive(cutoff: Date) {
    const inactive = await this.conversations.find({
      select: { id: true, workspaceId: true },
      where: [
        { status: 'open', lastSeenAt: LessThan(cutoff) },
        { status: 'open', lastSeenAt: IsNull(), startedAt: LessThan(cutoff) },
      ],
    });
    if (inactive.length) {
      await this.conversations.update(
        { id: In(inactive.map((conversation) => conversation.id)) },
        { status: 'closed' },
      );
    }
    return inactive;
  }
  incrementUnread(id: string) {
    return this.conversations.increment({ id }, 'unread', 1);
  }
  countOpenAssigned(memberId: string, excludeConversationId: string) {
    return this.conversations
      .createQueryBuilder('conversation')
      .where('conversation.assignedMemberId = :memberId', { memberId })
      .andWhere('conversation.status = :status', { status: 'open' })
      .andWhere('conversation.id != :excludeConversationId', { excludeConversationId })
      .getCount();
  }
  async touchPresence(conversationId: string, socketId: string) {
    const now = new Date();
    await this.presence.manager.transaction(async (manager) => {
      const presence = manager.getRepository(PresenceSessionEntity);
      await presence.delete({ expiresAt: LessThan(now) });
      await presence.upsert(
        { id: socketId, conversationId, lastSeenAt: now, expiresAt: new Date(now.getTime() + 45_000) },
        ['id'],
      );
      await manager.update(ConversationEntity, conversationId, { lastSeenAt: now });
    });
    return now;
  }
  async removePresence(conversationId: string, socketId: string) {
    const lastSeenAt = new Date();
    await this.presence.manager.transaction(async (manager) => {
      await manager.delete(PresenceSessionEntity, { id: socketId });
      await manager.update(ConversationEntity, conversationId, { lastSeenAt });
    });
    return lastSeenAt;
  }
  async presenceFor(conversationIds: string[]) {
    if (!conversationIds.length) return new Map<string, Date>();
    const sessions = await this.presence.find({
      where: { conversationId: In(conversationIds), expiresAt: MoreThan(new Date()) },
      order: { lastSeenAt: 'DESC' },
    });
    const result = new Map<string, Date>();
    for (const session of sessions) {
      if (!result.has(session.conversationId)) result.set(session.conversationId, session.lastSeenAt);
    }
    return result;
  }
  async lastSeenFor(conversationIds: string[]) {
    if (!conversationIds.length) return new Map<string, Date>();
    const conversations = await this.conversations.find({
      select: { id: true, lastSeenAt: true },
      where: { id: In(conversationIds) },
    });
    return new Map(
      conversations
        .filter((conversation) => conversation.lastSeenAt)
        .map((conversation) => [conversation.id, conversation.lastSeenAt!]),
    );
  }
  async markMessagesRead(conversationId: string, reader: 'visitor' | 'agent') {
    const sender = reader === 'agent' ? 'visitor' : 'agent';
    const readAt = new Date();
    await this.messages.update({ conversationId, sender, readAt: IsNull() }, { readAt });
    if (reader === 'agent') await this.conversations.update(conversationId, { unread: 0 });
    return readAt;
  }
  async replaceTags(conversationId: string, names: string[]) {
    await this.tags.manager.transaction(async (manager) => {
      await manager.delete(ConversationTagEntity, { conversationId });
      if (names.length)
        await manager.save(
          ConversationTagEntity,
          names.map((name) => manager.create(ConversationTagEntity, { conversationId, name })),
        );
    });
  }
  async replaceNotes(
    conversationId: string,
    notes: { id: string; text: string; author: string; createdAt: string }[],
  ) {
    await this.notes.manager.transaction(async (manager) => {
      await manager.delete(ConversationNoteEntity, { conversationId });
      if (notes.length)
        await manager.save(
          ConversationNoteEntity,
          notes.map((note) =>
            manager.create(ConversationNoteEntity, {
              id: note.id,
              conversationId,
              text: note.text,
              author: note.author,
              createdAt: new Date(note.createdAt),
            }),
          ),
        );
    });
  }
  async stats(workspaceId: string) {
    const [total, open, closed, unread] = await Promise.all([
      this.conversations.countBy({ workspaceId }),
      this.conversations.countBy({ workspaceId, status: 'open' }),
      this.conversations.countBy({ workspaceId, status: 'closed' }),
      this.conversations
        .createQueryBuilder('conversation')
        .select('COALESCE(SUM(conversation.unread), 0)', 'value')
        .where('conversation.workspaceId = :workspaceId', { workspaceId })
        .getRawOne<{ value: string }>(),
    ]);
    return { total, open, closed, unread: Number(unread?.value ?? 0) };
  }
}
