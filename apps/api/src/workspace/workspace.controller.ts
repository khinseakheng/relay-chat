import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AllowNoWorkspace } from '../common/decorators/allow-no-workspace.decorator';
import {
  CreateWidgetDto,
  CreateApiKeyDto,
  CreateWorkspaceDto,
  InviteMemberDto,
  ListAuditLogDto,
  UpdateAttachmentPolicyDto,
  UpdateMemberRoleDto,
  UpdateWidgetAppearanceDto,
  UpdateWidgetAvailabilityDto,
  UpdateWidgetCustomizationDto,
  UpdateWidgetPolicyDto,
} from './workspace.dto';
import type { WorkspaceRole } from './workspace.entities';
import { WorkspaceService } from './workspace.service';
import { StorageService } from '../storage/storage.service';

type AuthenticatedRequest = Request & {
  user: { id: string; name: string; workspaceId: string; role: WorkspaceRole };
};

@ApiTags('Workspace')
@ApiBearerAuth('access-token')
@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @AllowNoWorkspace()
  @ApiOperation({ summary: 'Create a workspace owned by the authenticated user' })
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateWorkspaceDto) {
    return this.workspace.create(request.user.id, body.name);
  }

  @Get()
  @ApiOperation({ summary: 'Get the active workspace, members, widgets, and invitations' })
  overview(@Req() request: AuthenticatedRequest) {
    return this.workspace.overview(request.user.workspaceId);
  }

  @Get('widgets')
  listWidgets(@Req() request: AuthenticatedRequest) {
    return this.workspace.listWidgets(request.user.workspaceId);
  }

  @Get('members')
  listMembers(@Req() request: AuthenticatedRequest) {
    return this.workspace.listMembers(request.user.workspaceId);
  }

  @Post('widgets')
  createWidget(@Req() request: AuthenticatedRequest, @Body() body: CreateWidgetDto) {
    return this.workspace.createWidget(request.user.workspaceId, request.user.role, body);
  }

  @Patch('widgets/:widgetId/policy')
  updateWidgetPolicy(
    @Req() request: AuthenticatedRequest,
    @Param('widgetId') widgetId: string,
    @Body() body: UpdateWidgetPolicyDto,
  ) {
    return this.workspace.updateWidgetPolicy(request.user.workspaceId, widgetId, request.user.role, body);
  }

  @Get('api-keys')
  listApiKeys(@Req() request: AuthenticatedRequest) {
    return this.workspace.listApiKeys(request.user.workspaceId, request.user.role);
  }

  @Post('api-keys')
  createApiKey(@Req() request: AuthenticatedRequest, @Body() body: CreateApiKeyDto) {
    return this.workspace.createApiKey(request.user.workspaceId, request.user, body);
  }

  @Delete('api-keys/:keyId')
  revokeApiKey(@Req() request: AuthenticatedRequest, @Param('keyId') keyId: string) {
    return this.workspace.revokeApiKey(request.user.workspaceId, keyId, request.user);
  }

  @Patch('widgets/:widgetId/appearance')
  updateWidgetAppearance(
    @Req() request: AuthenticatedRequest,
    @Param('widgetId') widgetId: string,
    @Body() body: UpdateWidgetAppearanceDto,
  ) {
    return this.workspace.updateWidgetAppearance(request.user.workspaceId, widgetId, request.user.role, body);
  }

  @Patch('widgets/:widgetId/availability')
  updateWidgetAvailability(
    @Req() request: AuthenticatedRequest,
    @Param('widgetId') widgetId: string,
    @Body() body: UpdateWidgetAvailabilityDto,
  ) {
    return this.workspace.updateWidgetAvailability(
      request.user.workspaceId,
      widgetId,
      request.user.role,
      body,
    );
  }

  @Patch('widgets/:widgetId/customization')
  updateWidgetCustomization(
    @Req() request: AuthenticatedRequest,
    @Param('widgetId') widgetId: string,
    @Body() body: UpdateWidgetCustomizationDto,
  ) {
    return this.workspace.updateWidgetCustomization(
      request.user.workspaceId,
      widgetId,
      request.user.role,
      body,
    );
  }

  @Post('widgets/:widgetId/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1_024 * 1_024, files: 1 } }))
  async uploadWidgetLogo(
    @Req() request: AuthenticatedRequest,
    @Param('widgetId') widgetId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A logo image is required');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('The logo must be an image');
    await this.workspace.assertWidgetAdmin(request.user.workspaceId, widgetId, request.user.role);
    const stored = await this.storage.upload(file);
    return this.workspace.setWidgetLogo(request.user.workspaceId, widgetId, stored.url);
  }

  @Post('invitations')
  invite(@Req() request: AuthenticatedRequest, @Body() body: InviteMemberDto) {
    return this.workspace.invite(request.user.workspaceId, request.user, body);
  }

  @Delete('invitations/:invitationId')
  cancelInvitation(@Req() request: AuthenticatedRequest, @Param('invitationId') invitationId: string) {
    return this.workspace.cancelInvitation(request.user.workspaceId, invitationId, request.user);
  }

  @Public()
  @Get('invitations/:token')
  invitation(@Param('token') token: string) {
    return this.workspace.invitation(token);
  }

  @Patch('members/:memberId/role')
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return this.workspace.updateRole(request.user.workspaceId, memberId, request.user, body.role);
  }

  @Delete('members/:memberId')
  removeMember(@Req() request: AuthenticatedRequest, @Param('memberId') memberId: string) {
    return this.workspace.removeMember(request.user.workspaceId, memberId, request.user);
  }

  @Get('attachment-policy')
  attachmentPolicy(@Req() request: AuthenticatedRequest) {
    return this.workspace.attachmentPolicy(request.user.workspaceId);
  }

  @Patch('attachment-policy')
  updateAttachmentPolicy(@Req() request: AuthenticatedRequest, @Body() body: UpdateAttachmentPolicyDto) {
    return this.workspace.updateAttachmentPolicy(request.user.workspaceId, request.user, body);
  }

  @Get('audit-log')
  auditLog(@Req() request: AuthenticatedRequest, @Query() query: ListAuditLogDto) {
    return this.workspace.listAuditLog(request.user.workspaceId, request.user.role, query.page, query.limit);
  }
}
