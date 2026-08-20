import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type WorkspaceRole = 'owner' | 'admin' | 'agent' | 'viewer';
export type AvailabilityMode = 'auto' | 'online' | 'offline';
export type WidgetAuthenticationMode = 'public' | 'authenticated' | 'hybrid';
export type AttachmentCategory = 'images' | 'pdf' | 'documents' | 'spreadsheets' | 'archives' | 'text';
export type BusinessHour = { day: number; enabled: boolean; start: string; end: string };
export type PreChatFields = {
  name: { enabled: boolean; required: boolean };
  email: { enabled: boolean; required: boolean };
};
export type WidgetCustomField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'select';
  required: boolean;
  options: string[];
};

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column() name: string;
  @Column() passwordHash: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('workspaces')
export class WorkspaceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ unique: true }) slug: string;
  @Column('uuid') createdBy: string;
  @Column({ default: 5 }) attachmentMaxSizeMb: number;
  @Column({
    type: 'jsonb',
    default: () => `'["images","pdf","documents","spreadsheets","archives","text"]'::jsonb`,
  })
  attachmentAllowedTypes: AttachmentCategory[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('workspace_members')
@Unique(['workspaceId', 'userId'])
export class WorkspaceMemberEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') userId: string;
  @Column({ type: 'varchar' }) role: WorkspaceRole;
  @Column({ default: 0 }) sessionVersion: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('chat_widgets')
@Index(['workspaceId'])
export class ChatWidgetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column({ unique: true }) siteId: string;
  @Column() name: string;
  @Column({ default: 'Chat with us' }) title: string;
  @Column({ default: '#6557e8' }) color: string;
  @Column({ default: true }) enabled: boolean;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) allowedDomains: string[];
  @Column({ default: 'public' }) authenticationMode: WidgetAuthenticationMode;
  @Column({ default: 'auto' }) availabilityMode: AvailabilityMode;
  @Column({ default: 'UTC' }) timezone: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) businessHours: BusinessHour[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) holidays: string[];
  @Column({ default: true }) offlineFormEnabled: boolean;
  @Column({ default: 'We are currently offline. Leave a message and we will get back to you.' })
  offlineMessage: string;
  @Column({ default: 'Typically replies within a few minutes' }) expectedResponseTime: string;
  @Column({ default: 0 }) maxActiveConversationsPerAgent: number;
  @Column({ default: 'Tell us what you need. We’re happy to help.' }) greeting: string;
  @Column({ default: 'Hi there 👋 How can we help today?' }) welcomeMessage: string;
  @Column({ type: 'text', nullable: true }) logoUrl?: string;
  @Column({ default: 'sparkle' }) launcherIcon: 'sparkle' | 'chat' | 'logo';
  @Column({ default: 'bottom-right' }) position: 'bottom-right' | 'bottom-left';
  @Column({ default: 18 }) offsetX: number;
  @Column({ default: 18 }) offsetY: number;
  @Column({ default: 'light' }) theme: 'light' | 'dark' | 'auto';
  @Column({ default: true }) showOnMobile: boolean;
  @Column({ default: 'en' }) language: string;
  @Column({
    type: 'jsonb',
    default: () =>
      `'${JSON.stringify({ name: { enabled: true, required: true }, email: { enabled: true, required: false } })}'::jsonb`,
  })
  preChatFields: PreChatFields;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) customFields: WidgetCustomField[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('workspace_api_keys')
@Index(['workspaceId', 'createdAt'])
@Index(['prefix'], { unique: true })
export class WorkspaceApiKeyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') widgetId: string;
  @Column() name: string;
  @Column() prefix: string;
  @Column() secretHash: string;
  @Column({ type: 'jsonb', default: () => `'["widget:sessions:create"]'::jsonb` }) scopes: string[];
  @Column('uuid') createdBy: string;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt?: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt?: Date;
  @Column({ type: 'timestamptz', nullable: true }) lastUsedAt?: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('widget_bootstrap_tokens')
@Index(['expiresAt'])
export class WidgetBootstrapTokenEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) jtiHash: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid') widgetId: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) usedAt?: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('workspace_invitations')
@Index(['workspaceId'])
export class WorkspaceInvitationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column({ nullable: true }) email?: string;
  @Column({ type: 'varchar' }) role: Exclude<WorkspaceRole, 'owner'>;
  @Column({ unique: true }) tokenHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) acceptedAt?: Date;
  @Column({ type: 'timestamptz', nullable: true }) canceledAt?: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('workspace_audit_logs')
@Index(['workspaceId', 'createdAt'])
export class WorkspaceAuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') workspaceId: string;
  @Column('uuid', { nullable: true }) actorUserId?: string;
  @Column() actorName: string;
  @Column() action: string;
  @Column({ nullable: true }) targetType?: string;
  @Column({ nullable: true }) targetId?: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
