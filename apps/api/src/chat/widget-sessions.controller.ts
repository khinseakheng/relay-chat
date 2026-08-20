import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { WorkspaceService } from '../workspace/workspace.service';
import { CreateExternalWidgetSessionDto } from './chat.dto';
import { WidgetService } from './widget.service';

@ApiTags('Widget authentication')
@Controller('v1/widget-sessions')
export class WidgetSessionsController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly widget: WidgetService,
  ) {}

  @Public()
  @Post()
  @ApiBearerAuth('widget-api-key')
  @ApiOperation({
    summary: 'Create a one-time authenticated widget bootstrap token',
    description:
      'Call this endpoint from your website backend after verifying its logged-in user. The API key must remain server-side. The returned token expires after 60 seconds and can be exchanged only once by the embedded widget.',
  })
  @ApiBody({
    type: CreateExternalWidgetSessionDto,
    examples: {
      authenticatedCustomer: {
        summary: 'Verified website customer',
        value: {
          siteId: 'your-widget-site-id',
          externalUserId: 'account_12345',
          name: 'Customer name',
          email: 'customer@example.com',
          metadata: { plan: 'pro', company: 'Example Ltd' },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'A short-lived, one-time bootstrap token was issued.',
    schema: {
      example: {
        success: true,
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          expiresAt: '2026-08-19T08:01:00.000Z',
        },
        meta: { timestamp: '2026-08-19T08:00:00.000Z' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'The identity or site ID is malformed.' })
  @ApiUnauthorizedResponse({ description: 'The widget API key is missing, invalid, expired, or revoked.' })
  @ApiForbiddenResponse({ description: 'The key lacks permission or the widget is disabled.' })
  async create(@Req() request: Request, @Body() body: CreateExternalWidgetSessionDto) {
    const widget = await this.workspace.authenticateWidgetApiKey(this.bearerToken(request), body.siteId);
    return this.widget.issueBootstrap(widget, body);
  }

  private bearerToken(request: Request) {
    const [scheme, token] = request.headers.authorization?.split(' ') || [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('A widget API key is required');
    }
    return token;
  }
}
