import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AllowNoWorkspace } from '../common/decorators/allow-no-workspace.decorator';
import { AuthService } from './auth.service';
import { AcceptInviteDto, LoginDto, RegisterDto } from './auth.dto';

const REFRESH_COOKIE = 'relay_refresh_token';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Sign in an operator and set a refresh-token cookie' })
  @ApiBody({ type: LoginDto })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body.email, body.password);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Create a user, workspace, owner membership, and first chat widget' })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(body);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Accept a workspace invitation and start a session' })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: AcceptInviteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.acceptInvitation(token, body);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Rotate the refresh token and return a new access token' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(request.cookies?.[REFRESH_COOKIE]);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Get('workspaces')
  @AllowNoWorkspace()
  listWorkspaces(@Req() request: Request & { user: { id: string } }) {
    return this.auth.listWorkspaces(request.user.id);
  }

  @Post('switch-workspace/:workspaceId')
  @AllowNoWorkspace()
  async switchWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Req() request: Request & { user: { id: string } },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.switchWorkspace(request.user.id, workspaceId);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Clear the operator refresh token' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    return { loggedOut: true };
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1_000,
    });
  }

  private cookieOptions() {
    const publicUrl = process.env.API_PUBLIC_URL || 'http://localhost:3000';
    const secure = process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : publicUrl.startsWith('https://');
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/auth',
    };
  }
}
