import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly workspace: WorkspaceService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'relay-development-secret-change-me'),
    });
  }
  async validate(payload: {
    sub: string;
    email: string;
    name: string;
    role?: string;
    workspaceId?: string;
    membershipId?: string;
    sessionVersion?: number;
  }) {
    const membership = payload.workspaceId
      ? await this.workspace.membership(payload.sub, payload.workspaceId)
      : undefined;
    if (payload.workspaceId && (!membership || membership.id !== payload.membershipId)) {
      throw new UnauthorizedException('Workspace membership no longer exists');
    }
    if (membership && membership.sessionVersion !== (payload.sessionVersion ?? 0)) {
      throw new UnauthorizedException('Workspace session was revoked');
    }
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: membership?.role,
      workspaceId: membership?.workspaceId,
    };
  }
}
