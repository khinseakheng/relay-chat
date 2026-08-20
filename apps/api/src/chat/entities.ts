import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('conversations')
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) workspaceId?: string;
  @Column({ default: 'demo' }) siteId: string;
  @Column({ nullable: true }) externalUserId?: string;
  @Column({ default: false }) authenticated: boolean;
  @Column() visitorName: string;
  @Column({ default: '' }) visitorEmail: string;
  @Column({ default: 'Unknown location' }) visitorLocation: string;
  @Column({ default: 'Web visitor' }) visitorBrowser: string;
  @Column({ default: 'V' }) visitorInitials: string;
  @Column({ default: 'open' }) status: 'open' | 'closed';
  @Column({ default: 0 }) unread: number;
  @Column({ default: 'Unassigned' }) assignedTo: string;
  @Column({ type: 'uuid', nullable: true }) assignedMemberId?: string;
  @Column({ default: '/' }) page: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) customFields: Record<string, string>;
  @CreateDateColumn({ type: 'timestamptz' }) startedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt?: Date;
  @OneToMany(() => MessageEntity, (message) => message.conversation, { cascade: true })
  messages: MessageEntity[];
  @OneToMany(() => ConversationTagEntity, (tag) => tag.conversation) tagEntities: ConversationTagEntity[];
  @OneToMany(() => ConversationNoteEntity, (note) => note.conversation)
  noteEntities: ConversationNoteEntity[];
}

@Entity('conversation_tags')
@Unique(['conversationId', 'name'])
export class ConversationTagEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') conversationId: string;
  @ManyToOne(() => ConversationEntity, (conversation) => conversation.tagEntities, { onDelete: 'CASCADE' })
  conversation: ConversationEntity;
  @Column() name: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('conversation_notes')
@Index(['conversationId', 'createdAt'])
export class ConversationNoteEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') conversationId: string;
  @ManyToOne(() => ConversationEntity, (conversation) => conversation.noteEntities, { onDelete: 'CASCADE' })
  conversation: ConversationEntity;
  @Column('text') text: string;
  @Column() author: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('messages')
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') conversationId: string;
  @ManyToOne(() => ConversationEntity, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  conversation: ConversationEntity;
  @Column() sender: 'visitor' | 'agent';
  @Column() senderName: string;
  @Column({ type: 'uuid', nullable: true }) senderUserId?: string;
  @Column('text') text: string;
  @Column({ type: 'varchar', nullable: true }) attachmentName?: string | null;
  @Column({ type: 'varchar', nullable: true }) attachmentMime?: string | null;
  @Column({ type: 'text', nullable: true }) attachmentData?: string | null;
  @Column({ type: 'text', nullable: true }) attachmentUrl?: string | null;
  @Column({ type: 'varchar', nullable: true }) attachmentKey?: string | null;
  @Column({ type: 'integer', nullable: true }) attachmentSize?: number | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) readAt?: Date;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt?: Date;
}

@Entity('presence_sessions')
@Index(['conversationId', 'expiresAt'])
export class PresenceSessionEntity {
  @PrimaryColumn() id: string;
  @Column('uuid') conversationId: string;
  @ManyToOne(() => ConversationEntity, { onDelete: 'CASCADE' }) conversation: ConversationEntity;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz' }) lastSeenAt: Date;
}
