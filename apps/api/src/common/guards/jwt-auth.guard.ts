import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_NO_WORKSPACE_KEY } from '../decorators/allow-no-workspace.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const authenticated = await super.canActivate(context);
    const allowNoWorkspace = this.reflector.getAllAndOverride<boolean>(ALLOW_NO_WORKSPACE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<{ user?: { workspaceId?: string } }>();
    if (!allowNoWorkspace && !request.user?.workspaceId) {
      throw new ForbiddenException('Select or create a workspace to continue');
    }
    return Boolean(authenticated);
  }
}
