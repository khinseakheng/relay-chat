import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import { ChatService } from './chat.service';
import {
  CreateConversationDto,
  ExchangeWidgetSessionDto,
  ListConversationsDto,
  UpdateConversationDto,
  VisitorProfileDto,
} from './chat.dto';
import { WidgetService } from './widget.service';
import { StorageService } from '../storage/storage.service';
import type { WorkspaceRole } from '../workspace/workspace.entities';
import { WorkspaceService } from '../workspace/workspace.service';
import { ChatGateway } from './chat.gateway';

type AuthenticatedRequest = Request & {
  user: { id: string; name: string; workspaceId: string; role: WorkspaceRole };
};

@ApiTags('Conversations')
@ApiBearerAuth('access-token')
@Controller()
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly widget: WidgetService,
    private readonly storage: StorageService,
    private readonly workspace: WorkspaceService,
    private readonly gateway: ChatGateway,
  ) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List or search operator inbox conversations' })
  list(@Req() request: AuthenticatedRequest, @Query() query: ListConversationsDto) {
    return this.chat.list(request.user.workspaceId, query);
  }

  @Get('stats')
  stats(@Req() request: AuthenticatedRequest) {
    return this.chat.stats(request.user.workspaceId);
  }

  @Post('workspace/members/:memberId/revoke-sessions')
  async revokeMemberSessions(@Req() request: AuthenticatedRequest, @Param('memberId') memberId: string) {
    const result = await this.workspace.revokeMemberSessions(
      request.user.workspaceId,
      memberId,
      request.user,
    );
    this.gateway.disconnectMember(request.user.workspaceId, result.userId);
    return { revoked: true };
  }

  @Get('conversations/:id')
  get(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.chat.get(id, request.user.workspaceId);
  }

  @Delete('conversations/:conversationId/messages/:messageId')
  async unsendMessage(
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.requireReplyRole(request.user.role);
    const result = await this.chat.unsendAgentMessage(
      conversationId,
      messageId,
      request.user.workspaceId,
      request.user.id,
      request.user.role,
    );
    this.gateway.broadcastMessageUnsent(result);
    return result.event;
  }

  @Post('conversations/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1_024 * 1_024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a conversation attachment to the configured storage driver' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadAttachment(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.requireReplyRole(request.user.role);
    if (!file) throw new BadRequestException('A file is required');
    await this.chat.get(id, request.user.workspaceId);
    const policy = await this.workspace.attachmentPolicy(request.user.workspaceId);
    return this.storage.upload(file, policy);
  }

  @Public()
  @Post('widget-api/conversations/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1_024 * 1_024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment from the embeddable visitor widget' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadWidgetAttachment(
    @Param('id') id: string,
    @Req() request: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A file is required');
    this.widget.verifyVisitorSession(this.bearerToken(request), id);
    const conversation = await this.chat.get(id);
    const widget = await this.workspace.widgetBySiteId(conversation.siteId);
    const policy = await this.workspace.attachmentPolicy(widget.workspaceId);
    return this.storage.upload(file, policy);
  }

  @Public()
  @Get('widget-api/conversations/:id')
  getForWidget(@Param('id') id: string, @Req() request: Request) {
    this.widget.verifyVisitorSession(this.bearerToken(request), id);
    return this.chat.get(id);
  }

  @Public()
  @Get('widget-api/config/:siteId')
  async widgetPublicConfig(@Param('siteId') siteId: string) {
    const configured = await this.workspace.widgetBySiteId(siteId);
    return {
      siteId: configured.siteId,
      enabled: configured.enabled,
      authenticationMode: configured.authenticationMode,
    };
  }

  @Public()
  @Post('widget-api/session/exchange')
  exchangeWidgetSession(@Body() body: ExchangeWidgetSessionDto) {
    return this.widget.exchangeBootstrap(body.token);
  }

  @Public()
  @Post('conversations')
  async create(@Body() body: CreateConversationDto) {
    let session;
    try {
      session = this.widget.verifySession(body.widgetToken, body.siteId || 'demo');
    } catch {
      throw new UnauthorizedException('Widget session is invalid or expired');
    }
    const configured = await this.workspace.widgetBySiteId(body.siteId || 'demo');
    if (session.workspaceId !== configured.workspaceId) {
      throw new UnauthorizedException('Widget session does not belong to this workspace');
    }
    if (configured.authenticationMode === 'authenticated' && !session.authenticated) {
      throw new UnauthorizedException('This widget requires an authenticated user');
    }
    const conversation = await this.chat.create(
      body.siteId || 'demo',
      session.authenticated ? session.name : body.name,
      session.authenticated ? session.email : body.email,
      body.page,
      body.initialMessage,
      body.customFields,
      session.authenticated
        ? {
            externalUserId: session.externalUserId!,
            metadata: session.metadata || {},
          }
        : undefined,
    );
    this.gateway.broadcastConversationUpdated(conversation);
    return { conversation, visitorToken: this.widget.createVisitorSession(conversation) };
  }

  @Patch('conversations/:id')
  update(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() body: UpdateConversationDto) {
    this.requireReplyRole(request.user.role);
    return this.chat.update(id, request.user.workspaceId, body);
  }

  @Public()
  @Patch('widget-api/conversations/:id/profile')
  updateVisitor(@Param('id') id: string, @Req() request: Request, @Body() body: VisitorProfileDto) {
    this.widget.verifyVisitorSession(this.bearerToken(request), id);
    return this.chat.updateVisitor(id, body);
  }

  @Public()
  @RawResponse()
  @Get('widget.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  widgetScript() {
    return this.widget.loader();
  }

  @Public()
  @RawResponse()
  @Get('widget/:siteId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async widgetPage(@Param('siteId') siteId: string, @Req() request: Request) {
    const configured = await this.workspace.authorizeWidgetDomain(siteId, request.headers.referer);
    const attachmentPolicy = await this.workspace.attachmentPolicy(configured.workspaceId);
    return this.widget.page({
      siteId,
      title: configured.title,
      color: configured.color,
      widgetToken:
        configured.authenticationMode === 'authenticated' ? '' : this.widget.createSession(configured),
      authenticationMode: configured.authenticationMode,
      available: this.workspace.widgetAvailability(configured),
      offlineFormEnabled: configured.offlineFormEnabled,
      offlineMessage: configured.offlineMessage,
      expectedResponseTime: configured.expectedResponseTime,
      greeting: configured.greeting,
      welcomeMessage: configured.welcomeMessage,
      logoUrl: configured.logoUrl,
      launcherIcon: configured.launcherIcon,
      position: configured.position,
      offsetX: configured.offsetX,
      offsetY: configured.offsetY,
      theme: configured.theme,
      showOnMobile: configured.showOnMobile,
      language: configured.language,
      preChatFields: configured.preChatFields,
      customFields: configured.customFields,
      attachmentMaxSizeMb: attachmentPolicy.maxSizeMb,
      attachmentAllowedTypes: attachmentPolicy.allowedTypes,
    });
  }

  private requireReplyRole(role: WorkspaceRole) {
    if (role === 'viewer') throw new ForbiddenException('Viewer members have read-only access');
  }

  private bearerToken(request: Request) {
    const [scheme, token] = request.headers.authorization?.split(' ') || [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('A bearer token is required');
    }
    return token;
  }
}
