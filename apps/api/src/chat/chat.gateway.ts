import { JwtService } from '@nestjs/jwt';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Sender } from './chat.types';
import type { AgentPayload } from '../auth/auth.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { WidgetService } from './widget.service';

type JoinBody = { conversationId: string; role: 'visitor' | 'agent'; visitorToken?: string };

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private inactivityTimer?: NodeJS.Timeout;
  private closingInactive = false;

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly workspace: WorkspaceService,
    private readonly widget: WidgetService,
  ) {}

  afterInit() {
    this.inactivityTimer = setInterval(() => void this.closeInactiveConversations(), 30_000);
    this.inactivityTimer.unref();
    void this.closeInactiveConversations();
  }

  onModuleDestroy() {
    if (this.inactivityTimer) clearInterval(this.inactivityTimer);
  }

  async handleConnection(client: Socket) {
    if (!client.handshake.auth?.token) return;
    try {
      const agent = await this.verifyAgent(client);
      client.data.agentUserId = agent.sub;
      client.data.agentWorkspaceId = agent.workspaceId;
      await client.join(this.workspaceRoom(agent.workspaceId));
      await client.join(this.memberRoom(agent.workspaceId, agent.sub));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('join')
  async join(@MessageBody() body: JoinBody, @ConnectedSocket() client: Socket) {
    const agent = body.role === 'agent' ? await this.verifyAgent(client) : undefined;
    if (body.role === 'visitor') {
      try {
        this.widget.verifyVisitorSession(body.visitorToken || '', body.conversationId);
      } catch {
        throw new WsException('Unauthorized visitor session');
      }
    }
    const conversation = await this.chat.get(body.conversationId, agent?.workspaceId);
    await client.join(body.conversationId);
    if (agent) await client.join(this.workspaceRoom(agent.workspaceId));
    if (body.role === 'visitor') {
      client.data.visitorConversationId = body.conversationId;
      const presence = await this.chat.touchPresence(body.conversationId, client.id);
      this.server.to(this.workspaceRoom(conversation.workspaceId!)).emit('conversation:presence', presence);
    }
  }

  @SubscribeMessage('presence:heartbeat')
  async heartbeat(@MessageBody() body: { conversationId: string }, @ConnectedSocket() client: Socket) {
    if (client.data.visitorConversationId !== body.conversationId) return;
    const presence = await this.chat.touchPresence(body.conversationId, client.id);
    const conversation = await this.chat.get(body.conversationId);
    this.server.to(this.workspaceRoom(conversation.workspaceId!)).emit('conversation:presence', presence);
  }

  async handleDisconnect(client: Socket) {
    const conversationId = client.data.visitorConversationId as string | undefined;
    if (!conversationId) return;
    const presence = await this.chat.removePresence(conversationId, client.id);
    const conversation = await this.chat.get(conversationId);
    this.server.to(this.workspaceRoom(conversation.workspaceId!)).emit('conversation:presence', presence);
  }

  @SubscribeMessage('messages:read')
  async markRead(
    @MessageBody() body: { conversationId: string; reader: 'visitor' | 'agent' },
    @ConnectedSocket() client: Socket,
  ) {
    const agent = body.reader === 'agent' ? await this.verifyAgent(client) : undefined;
    if (body.reader === 'visitor' && client.data.visitorConversationId !== body.conversationId) {
      throw new WsException('Visitor is not joined to this conversation');
    }
    const event = await this.chat.markRead(body.conversationId, body.reader, agent?.workspaceId);
    this.server.to(body.conversationId).emit('messages:read', event);
    const conversation = await this.chat.get(body.conversationId, agent?.workspaceId);
    this.server.to(this.workspaceRoom(conversation.workspaceId!)).emit('conversation:updated', conversation);
  }

  @SubscribeMessage('message')
  async message(
    @MessageBody()
    body: {
      conversationId: string;
      sender: Sender;
      text: string;
      senderName?: string;
      attachment?: { name: string; mime: string; url: string; key?: string; size?: number };
    },
    @ConnectedSocket() client: Socket,
  ) {
    const agent = body.sender === 'agent' ? await this.verifyAgent(client, true) : undefined;
    if (body.sender === 'visitor') {
      if (client.data.visitorConversationId !== body.conversationId) {
        throw new WsException('Visitor is not joined to this conversation');
      }
      await this.chat.touchPresence(body.conversationId, client.id);
    }
    if (!body.text?.trim() && !body.attachment) throw new WsException('Message cannot be empty');
    if (body.text?.length > 4000) throw new WsException('Message is too long');
    if (body.attachment && !/^https?:\/\//i.test(body.attachment.url))
      throw new WsException('Attachment URL is invalid');
    const message = await this.chat.addMessage(
      body.conversationId,
      body.sender,
      body.text?.trim() || '',
      body.senderName,
      body.attachment,
      agent?.workspaceId,
      agent?.sub,
    );
    this.server.to(body.conversationId).emit('message', message);
    const conversation = await this.chat.get(body.conversationId, agent?.workspaceId);
    this.server.to(this.workspaceRoom(conversation.workspaceId!)).emit('conversation:updated', conversation);
    return message;
  }

  @SubscribeMessage('message:unsend')
  async unsendVisitor(
    @MessageBody() body: { conversationId: string; messageId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (client.data.visitorConversationId !== body.conversationId) {
      throw new WsException('Visitor is not joined to this conversation');
    }
    const result = await this.chat.unsendVisitorMessage(body.conversationId, body.messageId);
    this.broadcastMessageUnsent(result);
    return result.event;
  }

  @SubscribeMessage('typing')
  async typing(
    @MessageBody() body: { conversationId: string; sender: Sender; typing: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    if (body.sender === 'agent') {
      const agent = await this.verifyAgent(client, true);
      await this.chat.get(body.conversationId, agent.workspaceId);
    }
    if (body.sender === 'visitor' && client.data.visitorConversationId !== body.conversationId) {
      throw new WsException('Visitor is not joined to this conversation');
    }
    client.to(body.conversationId).emit('typing', body);
  }

  private async verifyAgent(client: Socket, requireReply = false) {
    try {
      const payload = await this.jwt.verifyAsync<AgentPayload>(client.handshake.auth?.token);
      if (!payload.workspaceId) throw new Error('No active workspace');
      const membership = await this.workspace.membership(payload.sub, payload.workspaceId);
      if (!membership) throw new Error('Membership no longer exists');
      if (
        membership.id !== payload.membershipId ||
        membership.sessionVersion !== (payload.sessionVersion ?? 0)
      ) {
        throw new Error('Workspace session was revoked');
      }
      if (requireReply && membership.role === 'viewer') throw new Error('Viewer is read-only');
      return { ...payload, workspaceId: payload.workspaceId, role: membership.role };
    } catch {
      throw new WsException('Unauthorized agent connection');
    }
  }

  private workspaceRoom(workspaceId: string) {
    return `workspace:${workspaceId}`;
  }

  disconnectMember(workspaceId: string, userId: string) {
    this.server.in(this.memberRoom(workspaceId, userId)).disconnectSockets(true);
  }

  broadcastMessageUnsent(result: {
    event: { conversationId: string; messageId: string; deletedAt: string };
    conversation: { workspaceId?: string };
  }) {
    this.server.to(result.event.conversationId).emit('message:deleted', result.event);
    this.broadcastConversationUpdated(result.conversation);
  }

  broadcastConversationUpdated(conversation: { workspaceId?: string }) {
    if (!conversation.workspaceId) return;
    this.server.to(this.workspaceRoom(conversation.workspaceId)).emit('conversation:updated', conversation);
  }

  private async closeInactiveConversations() {
    if (this.closingInactive) return;
    this.closingInactive = true;
    try {
      const closed = await this.chat.closeInactive(5 * 60_000);
      for (const conversation of closed) {
        if (conversation.workspaceId) {
          this.server
            .to(this.workspaceRoom(conversation.workspaceId))
            .emit('conversation:updated', conversation);
        }
      }
    } catch (error) {
      this.logger.error('Could not close inactive conversations', error);
    } finally {
      this.closingInactive = false;
    }
  }

  private memberRoom(workspaceId: string, userId: string) {
    return `workspace:${workspaceId}:member:${userId}`;
  }
}
