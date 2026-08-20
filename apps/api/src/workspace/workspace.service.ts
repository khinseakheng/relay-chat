import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChatWidgetEntity,
  type AttachmentCategory,
  type AvailabilityMode,
  type BusinessHour,
  UserEntity,
  WorkspaceEntity,
  WorkspaceAuditLogEntity,
  WorkspaceInvitationEntity,
  WorkspaceMemberEntity,
  type WorkspaceRole,
  type PreChatFields,
  type WidgetCustomField,
  WorkspaceApiKeyEntity,
  WidgetBootstrapTokenEntity,
  type WidgetAuthenticationMode,
} from './workspace.entities';

type WorkspaceActor = { id: string; name: string; role: WorkspaceRole };

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity) private readonly workspaces: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity) private readonly members: Repository<WorkspaceMemberEntity>,
    @InjectRepository(ChatWidgetEntity) private readonly widgets: Repository<ChatWidgetEntity>,
    @InjectRepository(WorkspaceInvitationEntity)
    private readonly invitations: Repository<WorkspaceInvitationEntity>,
    @InjectRepository(WorkspaceAuditLogEntity)
    private readonly auditLogs: Repository<WorkspaceAuditLogEntity>,
    @InjectRepository(WorkspaceApiKeyEntity)
    private readonly apiKeys: Repository<WorkspaceApiKeyEntity>,
    @InjectRepository(WidgetBootstrapTokenEntity)
    private readonly bootstrapTokens: Repository<WidgetBootstrapTokenEntity>,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string, name: string) {
    const workspaceName = name.trim();
    const slug = `${this.slug(workspaceName)}-${randomBytes(4).toString('hex')}`;
    return this.workspaces.manager.transaction(async (manager) => {
      const workspace = await manager.save(
        WorkspaceEntity,
        manager.create(WorkspaceEntity, {
          name: workspaceName,
          slug,
          createdBy: userId,
        }),
      );
      await manager.save(
        WorkspaceMemberEntity,
        manager.create(WorkspaceMemberEntity, {
          workspaceId: workspace.id,
          userId,
          role: 'owner',
        }),
      );
      await manager.save(
        ChatWidgetEntity,
        manager.create(ChatWidgetEntity, {
          workspaceId: workspace.id,
          siteId: `${slug}-${randomBytes(3).toString('hex')}`,
          name: 'Website chat',
          title: `Chat with ${workspace.name}`,
        }),
      );
      return workspace;
    });
  }

  async overview(workspaceId: string) {
    const [workspace, members, widgets, invitations] = await Promise.all([
      this.workspaces.findOneBy({ id: workspaceId }),
      this.listMembers(workspaceId),
      this.widgets.find({ where: { workspaceId }, order: { createdAt: 'ASC' } }),
      this.invitations.find({ where: { workspaceId }, order: { createdAt: 'DESC' } }),
    ]);
    if (!workspace) throw new NotFoundException('Workspace not found');
    return {
      workspace,
      members,
      widgets,
      invitations: invitations.map((item) => ({
        id: item.id,
        email: item.email || null,
        role: item.role,
        expiresAt: item.expiresAt,
        acceptedAt: item.acceptedAt || null,
        canceledAt: item.canceledAt || null,
        createdAt: item.createdAt,
      })),
    };
  }

  async listMembers(workspaceId: string) {
    return this.members
      .createQueryBuilder('member')
      .innerJoin(UserEntity, 'user', 'user.id = member.userId')
      .where('member.workspaceId = :workspaceId', { workspaceId })
      .select(['member.id AS id', 'member.role AS role', 'member.createdAt AS "createdAt"'])
      .addSelect(['user.id AS "userId"', 'user.name AS name', 'user.email AS email'])
      .orderBy('member.createdAt', 'ASC')
      .getRawMany();
  }

  assignmentMember(workspaceId: string, memberId: string) {
    return this.members
      .createQueryBuilder('member')
      .innerJoin(UserEntity, 'user', 'user.id = member.userId')
      .where('member.id = :memberId', { memberId })
      .andWhere('member.workspaceId = :workspaceId', { workspaceId })
      .andWhere('member.role != :viewer', { viewer: 'viewer' })
      .select(['member.id AS id', 'member.role AS role', 'user.name AS name'])
      .getRawOne<{ id: string; role: WorkspaceRole; name: string }>();
  }

  membership(userId: string, workspaceId: string) {
    return this.members.findOneBy({ userId, workspaceId });
  }

  listUserWorkspaces(userId: string) {
    return this.members
      .createQueryBuilder('member')
      .innerJoin(WorkspaceEntity, 'workspace', 'workspace.id = member.workspaceId')
      .where('member.userId = :userId', { userId })
      .select([
        'workspace.id AS id',
        'workspace.name AS name',
        'workspace.slug AS slug',
        'member.role AS role',
      ])
      .orderBy('member.createdAt', 'ASC')
      .getRawMany<{ id: string; name: string; slug: string; role: WorkspaceRole }>();
  }

  async createWidget(
    workspaceId: string,
    actorRole: WorkspaceRole,
    input: { name: string; title?: string; color?: string },
  ) {
    this.requireAdmin(actorRole);
    const siteId = `${this.slug(input.name)}-${randomBytes(4).toString('hex')}`;
    return this.widgets.save(
      this.widgets.create({ workspaceId, siteId, name: input.name, title: input.title, color: input.color }),
    );
  }

  async widgetBySiteId(siteId: string) {
    const widget = await this.widgets.findOneBy({ siteId });
    if (!widget) throw new NotFoundException('Chat widget not found');
    return widget;
  }

  listWidgets(workspaceId: string) {
    return this.widgets.find({ where: { workspaceId }, order: { createdAt: 'ASC' } });
  }

  async updateWidgetPolicy(
    workspaceId: string,
    widgetId: string,
    actorRole: WorkspaceRole,
    input: { enabled: boolean; authenticationMode: WidgetAuthenticationMode; allowedDomains: string[] },
  ) {
    this.requireAdmin(actorRole);
    const widget = await this.widgets.findOneBy({ id: widgetId, workspaceId });
    if (!widget) throw new NotFoundException('Chat widget not found');
    widget.enabled = input.enabled;
    widget.authenticationMode = input.authenticationMode;
    widget.allowedDomains = [...new Set(input.allowedDomains.map((value) => this.normalizeDomain(value)))];
    return this.widgets.save(widget);
  }

  async createApiKey(
    workspaceId: string,
    actor: WorkspaceActor,
    input: { name: string; widgetId: string; expiresAt?: string },
  ) {
    this.requireAdmin(actor.role);
    const widget = await this.widgets.findOneBy({ id: input.widgetId, workspaceId });
    if (!widget) throw new NotFoundException('Chat widget not found');
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('API key expiration must be in the future');
    }
    const prefix = randomBytes(6).toString('base64url');
    const secret = `rly_live_${prefix}_${randomBytes(24).toString('base64url')}`;
    const key = await this.apiKeys.save(
      this.apiKeys.create({
        workspaceId,
        widgetId: widget.id,
        name: input.name.trim(),
        prefix,
        secretHash: this.hashToken(secret),
        scopes: ['widget:sessions:create'],
        createdBy: actor.id,
        expiresAt,
      }),
    );
    await this.recordAudit(workspaceId, actor, 'api_key.created', 'api_key', key.id, {
      name: key.name,
      widgetId: widget.id,
      prefix,
      expiresAt: expiresAt?.toISOString() || null,
    });
    return { ...this.apiKeyView(key), secret };
  }

  async listApiKeys(workspaceId: string, actorRole: WorkspaceRole) {
    this.requireAdmin(actorRole);
    const keys = await this.apiKeys.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return keys.map((key) => this.apiKeyView(key));
  }

  async revokeApiKey(workspaceId: string, keyId: string, actor: WorkspaceActor) {
    this.requireAdmin(actor.role);
    const key = await this.apiKeys.findOneBy({ id: keyId, workspaceId });
    if (!key) throw new NotFoundException('API key not found');
    if (!key.revokedAt) {
      key.revokedAt = new Date();
      await this.apiKeys.save(key);
      await this.recordAudit(workspaceId, actor, 'api_key.revoked', 'api_key', key.id, {
        name: key.name,
        prefix: key.prefix,
      });
    }
    return { revoked: true };
  }

  async authenticateWidgetApiKey(secret: string, siteId: string) {
    const match = /^rly_live_([A-Za-z0-9_-]{8})_/.exec(secret);
    if (!match) throw new UnauthorizedException('API key is invalid');
    const key = await this.apiKeys.findOneBy({ prefix: match[1] });
    const suppliedHash = Buffer.from(this.hashToken(secret), 'hex');
    const storedHash = key ? Buffer.from(key.secretHash, 'hex') : Buffer.alloc(suppliedHash.length);
    if (!key || storedHash.length !== suppliedHash.length || !timingSafeEqual(storedHash, suppliedHash)) {
      throw new UnauthorizedException('API key is invalid');
    }
    if (key.revokedAt || (key.expiresAt && key.expiresAt.getTime() <= Date.now())) {
      throw new UnauthorizedException('API key is expired or revoked');
    }
    if (!key.scopes.includes('widget:sessions:create')) {
      throw new ForbiddenException('API key does not have widget session permission');
    }
    const widget = await this.widgets.findOneBy({ id: key.widgetId, workspaceId: key.workspaceId, siteId });
    if (!widget?.enabled) throw new ForbiddenException('Chat widget is unavailable');
    key.lastUsedAt = new Date();
    await this.apiKeys.save(key);
    return widget;
  }

  storeBootstrapToken(jti: string, widget: ChatWidgetEntity, expiresAt: Date) {
    return this.bootstrapTokens.save(
      this.bootstrapTokens.create({
        jtiHash: this.hashToken(jti),
        workspaceId: widget.workspaceId,
        widgetId: widget.id,
        expiresAt,
      }),
    );
  }

  async consumeBootstrapToken(jti: string, workspaceId: string, widgetId: string) {
    const now = new Date();
    const result = await this.bootstrapTokens
      .createQueryBuilder()
      .update(WidgetBootstrapTokenEntity)
      .set({ usedAt: now })
      .where('"jtiHash" = :jtiHash', { jtiHash: this.hashToken(jti) })
      .andWhere('"workspaceId" = :workspaceId', { workspaceId })
      .andWhere('"widgetId" = :widgetId', { widgetId })
      .andWhere('"usedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now })
      .execute();
    if (result.affected !== 1) throw new UnauthorizedException('Bootstrap token was already used or expired');
  }

  private apiKeyView(key: WorkspaceApiKeyEntity) {
    return {
      id: key.id,
      widgetId: key.widgetId,
      name: key.name,
      prefix: `rly_live_${key.prefix}`,
      scopes: key.scopes,
      expiresAt: key.expiresAt || null,
      revokedAt: key.revokedAt || null,
      lastUsedAt: key.lastUsedAt || null,
      createdAt: key.createdAt,
    };
  }

  async updateWidgetAppearance(
    workspaceId: string,
    widgetId: string,
    actorRole: WorkspaceRole,
    input: { name: string; title: string; color: string },
  ) {
    this.requireAdmin(actorRole);
    const widget = await this.widgets.findOneBy({ id: widgetId, workspaceId });
    if (!widget) throw new NotFoundException('Chat widget not found');
    Object.assign(widget, {
      name: input.name.trim(),
      title: input.title.trim(),
      color: input.color.toLowerCase(),
    });
    return this.widgets.save(widget);
  }

  async authorizeWidgetDomain(siteId: string, referrer?: string) {
    const widget = await this.widgetBySiteId(siteId);
    if (!widget.enabled) throw new ForbiddenException('This chat widget is disabled');
    if (!widget.allowedDomains.length) return widget;
    let hostname = '';
    try {
      hostname = new URL(referrer || '').hostname.toLowerCase();
    } catch {
      throw new ForbiddenException('This chat widget is not allowed on this domain');
    }
    const allowed = widget.allowedDomains.some((domain) =>
      domain.startsWith('*.')
        ? hostname.endsWith(domain.slice(1)) && hostname !== domain.slice(2)
        : hostname === domain,
    );
    if (!allowed) throw new ForbiddenException('This chat widget is not allowed on this domain');
    return widget;
  }

  async updateWidgetAvailability(
    workspaceId: string,
    widgetId: string,
    actorRole: WorkspaceRole,
    input: {
      availabilityMode: AvailabilityMode;
      timezone: string;
      businessHours: BusinessHour[];
      holidays: string[];
      offlineFormEnabled: boolean;
      offlineMessage: string;
      expectedResponseTime: string;
      maxActiveConversationsPerAgent: number;
    },
  ) {
    this.requireAdmin(actorRole);
    const widget = await this.widgets.findOneBy({ id: widgetId, workspaceId });
    if (!widget) throw new NotFoundException('Chat widget not found');
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format();
    } catch {
      throw new BadRequestException('Timezone is invalid');
    }
    const uniqueDays = new Set(input.businessHours.map((item) => item.day));
    if (uniqueDays.size !== input.businessHours.length) {
      throw new BadRequestException('Business hours contain duplicate days');
    }
    Object.assign(widget, {
      ...input,
      timezone: input.timezone.trim(),
      businessHours: [...input.businessHours].sort((a, b) => a.day - b.day),
      holidays: [...new Set(input.holidays)].sort(),
      offlineMessage: input.offlineMessage.trim(),
      expectedResponseTime: input.expectedResponseTime.trim(),
    });
    return this.widgets.save(widget);
  }

  async updateWidgetCustomization(
    workspaceId: string,
    widgetId: string,
    actorRole: WorkspaceRole,
    input: {
      greeting: string;
      welcomeMessage: string;
      launcherIcon: 'sparkle' | 'chat' | 'logo';
      position: 'bottom-right' | 'bottom-left';
      offsetX: number;
      offsetY: number;
      theme: 'light' | 'dark' | 'auto';
      showOnMobile: boolean;
      language: string;
      preChatFields: PreChatFields;
      customFields: WidgetCustomField[];
    },
  ) {
    const widget = await this.assertWidgetAdmin(workspaceId, widgetId, actorRole);
    const ids = new Set(input.customFields.map((field) => field.id));
    if (ids.size !== input.customFields.length) {
      throw new BadRequestException('Custom field IDs must be unique');
    }
    Object.assign(widget, {
      ...input,
      greeting: input.greeting.trim(),
      welcomeMessage: input.welcomeMessage.trim(),
      customFields: input.customFields.map((field) => ({
        ...field,
        label: field.label.trim(),
        options: [...new Set(field.options.map((option) => option.trim()).filter(Boolean))],
      })),
    });
    return this.widgets.save(widget);
  }

  async assertWidgetAdmin(workspaceId: string, widgetId: string, actorRole: WorkspaceRole) {
    this.requireAdmin(actorRole);
    const widget = await this.widgets.findOneBy({ id: widgetId, workspaceId });
    if (!widget) throw new NotFoundException('Chat widget not found');
    return widget;
  }

  async setWidgetLogo(workspaceId: string, widgetId: string, logoUrl: string) {
    const widget = await this.widgets.findOneByOrFail({ id: widgetId, workspaceId });
    widget.logoUrl = logoUrl;
    return this.widgets.save(widget);
  }

  widgetAvailability(widget: ChatWidgetEntity, now = new Date()) {
    if (widget.availabilityMode === 'online') return true;
    if (widget.availabilityMode === 'offline') return false;
    if (!widget.businessHours.length) return true;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: widget.timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value || '';
    const localDate = `${part('year')}-${part('month')}-${part('day')}`;
    if (widget.holidays.includes(localDate)) return false;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
    const schedule = widget.businessHours.find((item) => item.day === day);
    if (!schedule?.enabled) return false;
    const current = `${part('hour')}:${part('minute')}`;
    return schedule.start <= schedule.end
      ? current >= schedule.start && current < schedule.end
      : current >= schedule.start || current < schedule.end;
  }

  async invite(
    workspaceId: string,
    actor: WorkspaceActor,
    input: { email?: string; role: Exclude<WorkspaceRole, 'owner'> },
  ) {
    this.requireAdmin(actor.role);
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.invitations.save(
      this.invitations.create({
        workspaceId,
        email: input.email?.trim().toLowerCase(),
        role: input.role,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      }),
    );
    const webUrl = this.config.get<string>('WEB_PUBLIC_URL', 'http://localhost:5173').replace(/\/$/, '');
    const inviteUrl = `${webUrl}/invite/${token}`;
    const emailSent = invitation.email ? await this.sendInviteEmail(invitation.email, inviteUrl) : false;
    await this.recordAudit(workspaceId, actor, 'invitation.created', 'invitation', invitation.id, {
      email: invitation.email || null,
      role: invitation.role,
      emailSent,
    });
    return { id: invitation.id, inviteUrl, emailSent, expiresAt: invitation.expiresAt };
  }

  async cancelInvitation(workspaceId: string, invitationId: string, actor: WorkspaceActor) {
    this.requireAdmin(actor.role);
    const invitation = await this.invitations.findOneBy({ id: invitationId, workspaceId });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) throw new BadRequestException('Accepted invitations cannot be canceled');
    if (invitation.canceledAt) throw new BadRequestException('Invitation is already canceled');
    invitation.canceledAt = new Date();
    await this.invitations.save(invitation);
    await this.recordAudit(workspaceId, actor, 'invitation.canceled', 'invitation', invitation.id, {
      email: invitation.email || null,
      role: invitation.role,
    });
    return { canceled: true };
  }

  async invitation(token: string) {
    const invitation = await this.validInvitation(token);
    const workspace = await this.workspaces.findOneByOrFail({ id: invitation.workspaceId });
    return {
      workspaceName: workspace.name,
      email: invitation.email || null,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  async accept(token: string, userId: string) {
    const invitation = await this.validInvitation(token);
    const user = await this.users.findOneByOrFail({ id: userId });
    if (invitation.email && invitation.email !== user.email) {
      throw new ForbiddenException('This invitation belongs to another email address');
    }
    await this.invitations.manager.transaction(async (manager) => {
      await manager.upsert(
        WorkspaceMemberEntity,
        { workspaceId: invitation.workspaceId, userId, role: invitation.role },
        ['workspaceId', 'userId'],
      );
      await manager.update(WorkspaceInvitationEntity, invitation.id, { acceptedAt: new Date() });
      await manager.save(
        WorkspaceAuditLogEntity,
        manager.create(WorkspaceAuditLogEntity, {
          workspaceId: invitation.workspaceId,
          actorUserId: user.id,
          actorName: user.name,
          action: 'invitation.accepted',
          targetType: 'invitation',
          targetId: invitation.id,
          metadata: { email: user.email, role: invitation.role },
        }),
      );
    });
    return invitation.workspaceId;
  }

  async updateRole(
    workspaceId: string,
    memberId: string,
    actor: WorkspaceActor,
    role: Exclude<WorkspaceRole, 'owner'>,
  ) {
    this.requireAdmin(actor.role);
    const member = await this.members.findOneBy({ id: memberId, workspaceId });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') throw new BadRequestException('The owner role cannot be changed');
    const targetUser = await this.users.findOneBy({ id: member.userId });
    const previousRole = member.role;
    await this.members.update(member.id, { role });
    await this.recordAudit(workspaceId, actor, 'member.role_changed', 'member', member.id, {
      previousRole,
      role,
      userId: member.userId,
      memberName: targetUser?.name,
      memberEmail: targetUser?.email,
    });
    return this.listMembers(workspaceId);
  }

  async removeMember(workspaceId: string, memberId: string, actor: WorkspaceActor) {
    this.requireAdmin(actor.role);
    const member = await this.members.findOneBy({ id: memberId, workspaceId });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') throw new BadRequestException('The workspace owner cannot be removed');
    if (member.userId === actor.id) {
      throw new BadRequestException('You cannot remove yourself from the active workspace');
    }
    const targetUser = await this.users.findOneBy({ id: member.userId });
    await this.members.delete(member.id);
    await this.recordAudit(workspaceId, actor, 'member.removed', 'member', member.id, {
      userId: member.userId,
      role: member.role,
      memberName: targetUser?.name,
      memberEmail: targetUser?.email,
    });
    return { removed: true };
  }

  async revokeMemberSessions(workspaceId: string, memberId: string, actor: WorkspaceActor) {
    this.requireAdmin(actor.role);
    const member = await this.members.findOneBy({ id: memberId, workspaceId });
    if (!member) throw new NotFoundException('Member not found');
    if (member.userId === actor.id) {
      throw new BadRequestException('Use sign out to end your own current session');
    }
    const targetUser = await this.users.findOneBy({ id: member.userId });
    member.sessionVersion += 1;
    await this.members.save(member);
    await this.recordAudit(workspaceId, actor, 'member.sessions_revoked', 'member', member.id, {
      userId: member.userId,
      memberName: targetUser?.name,
      memberEmail: targetUser?.email,
    });
    return { revoked: true, userId: member.userId };
  }

  async attachmentPolicy(workspaceId: string) {
    const workspace = await this.workspaces.findOneBy({ id: workspaceId });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return {
      maxSizeMb: workspace.attachmentMaxSizeMb,
      allowedTypes: workspace.attachmentAllowedTypes,
    };
  }

  async updateAttachmentPolicy(
    workspaceId: string,
    actor: WorkspaceActor,
    input: { maxSizeMb: number; allowedTypes: AttachmentCategory[] },
  ) {
    this.requireAdmin(actor.role);
    const workspace = await this.workspaces.findOneBy({ id: workspaceId });
    if (!workspace) throw new NotFoundException('Workspace not found');
    workspace.attachmentMaxSizeMb = input.maxSizeMb;
    workspace.attachmentAllowedTypes = [...new Set(input.allowedTypes)];
    await this.workspaces.save(workspace);
    await this.recordAudit(workspaceId, actor, 'attachment_policy.updated', 'workspace', workspaceId, {
      maxSizeMb: input.maxSizeMb,
      allowedTypes: workspace.attachmentAllowedTypes,
    });
    return this.attachmentPolicy(workspaceId);
  }

  async listAuditLog(workspaceId: string, actorRole: WorkspaceRole, page: number, limit: number) {
    this.requireAdmin(actorRole);
    const [items, total] = await this.auditLogs.findAndCount({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, page, limit, total, hasMore: page * limit < total };
  }

  private async validInvitation(token: string) {
    const invitation = await this.invitations.findOneBy({ tokenHash: this.hashToken(token) });
    if (!invitation || invitation.acceptedAt || invitation.canceledAt || invitation.expiresAt <= new Date()) {
      throw new BadRequestException('Invitation is invalid or expired');
    }
    return invitation;
  }

  private requireAdmin(role: WorkspaceRole) {
    if (!['owner', 'admin'].includes(role)) throw new ForbiddenException('Admin permission is required');
  }

  private recordAudit(
    workspaceId: string,
    actor: Pick<WorkspaceActor, 'id' | 'name'>,
    action: string,
    targetType?: string,
    targetId?: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.auditLogs.save(
      this.auditLogs.create({
        workspaceId,
        actorUserId: actor.id,
        actorName: actor.name,
        action,
        targetType,
        targetId,
        metadata,
      }),
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private slug(value: string) {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 48) || 'widget'
    );
  }

  private normalizeDomain(value: string) {
    const input = value.trim().toLowerCase();
    if (!input) throw new BadRequestException('Allowed domains cannot be empty');
    const wildcard = input.startsWith('*.');
    const candidate = wildcard ? input.slice(2) : input;
    let hostname: string;
    try {
      hostname = new URL(candidate.includes('://') ? candidate : `https://${candidate}`).hostname;
    } catch {
      throw new BadRequestException(`Invalid allowed domain: ${value}`);
    }
    if (!hostname || hostname.includes('*')) {
      throw new BadRequestException(`Invalid allowed domain: ${value}`);
    }
    return wildcard ? `*.${hostname}` : hostname;
  }

  private async sendInviteEmail(email: string, inviteUrl: string) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) return false;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'relay-chat/1.0',
        },
        body: JSON.stringify({
          from: this.config.get<string>('INVITE_EMAIL_FROM', 'Relay <onboarding@example.com>'),
          to: [email],
          subject: 'You are invited to Relay Chat',
          html: `<p>You have been invited to a Relay Chat workspace.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
