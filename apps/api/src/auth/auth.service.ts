import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, WorkspaceMemberEntity, type WorkspaceRole } from '../workspace/workspace.entities';
import { WorkspaceService } from '../workspace/workspace.service';

const scrypt = promisify(scryptCallback);

export type AgentPayload = {
  sub: string;
  email: string;
  name: string;
  role?: WorkspaceRole;
  workspaceId?: string;
  membershipId?: string;
  sessionVersion?: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(WorkspaceMemberEntity) private readonly members: Repository<WorkspaceMemberEntity>,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findOneBy({ email: email.trim().toLowerCase() });
    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const membership = await this.members.findOne({
      where: { userId: user.id },
      order: { createdAt: 'ASC' },
    });
    return this.issueTokens(this.payload(user, membership));
  }

  async register(input: { email: string; password: string; name: string }) {
    const email = input.email.trim().toLowerCase();
    if (await this.users.existsBy({ email })) throw new ConflictException('Email is already registered');
    const user = await this.users.save(
      this.users.create({
        email,
        name: input.name.trim(),
        passwordHash: await this.hashPassword(input.password),
      }),
    );
    return this.issueTokens(this.payload(user));
  }

  async acceptInvitation(token: string, input: { email: string; password: string; name: string }) {
    const email = input.email.trim().toLowerCase();
    let user = await this.users.findOneBy({ email });
    if (user) {
      if (!(await this.verifyPassword(input.password, user.passwordHash))) {
        throw new UnauthorizedException('Password is incorrect for this existing account');
      }
    } else {
      user = await this.users.save(
        this.users.create({
          email,
          name: input.name.trim(),
          passwordHash: await this.hashPassword(input.password),
        }),
      );
    }
    const workspaceId = await this.workspaceService.accept(token, user.id);
    const membership = await this.members.findOneByOrFail({ workspaceId, userId: user.id });
    return this.issueTokens(this.payload(user, membership));
  }

  async refresh(refreshToken?: string) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is missing');

    try {
      const payload = await this.jwt.verifyAsync<AgentPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
      const user = await this.users.findOneBy({ id: payload.sub });
      if (!user) throw new Error('User no longer exists');
      const membership = payload.workspaceId
        ? await this.members.findOneBy({ userId: payload.sub, workspaceId: payload.workspaceId })
        : undefined;
      if (
        payload.workspaceId &&
        (!membership ||
          membership.id !== payload.membershipId ||
          membership.sessionVersion !== (payload.sessionVersion ?? 0))
      ) {
        throw new Error('Workspace session was revoked');
      }
      return this.issueTokens(this.payload(user, membership));
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  listWorkspaces(userId: string) {
    return this.workspaceService.listUserWorkspaces(userId);
  }

  async switchWorkspace(userId: string, workspaceId: string) {
    const [user, membership] = await Promise.all([
      this.users.findOneBy({ id: userId }),
      this.members.findOneBy({ userId, workspaceId }),
    ]);
    if (!user || !membership) throw new UnauthorizedException('Workspace membership was not found');
    return this.issueTokens(this.payload(user, membership));
  }

  private async issueTokens(payload: AgentPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload),
      this.jwt.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as JwtSignOptions['expiresIn'],
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role || null,
        workspaceId: payload.workspaceId || null,
      },
    };
  }

  private get refreshSecret() {
    return this.config.get<string>(
      'JWT_REFRESH_SECRET',
      `${this.config.get<string>('JWT_SECRET', 'relay-development-secret-change-me')}-refresh`,
    );
  }

  private payload(user: UserEntity, membership?: WorkspaceMemberEntity | null): AgentPayload {
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: membership?.role,
      workspaceId: membership?.workspaceId,
      membershipId: membership?.id,
      sessionVersion: membership?.sessionVersion,
    };
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${key.toString('hex')}`;
  }

  private async verifyPassword(password: string, stored: string) {
    const [algorithm, salt, encoded] = stored.split(':');
    if (algorithm !== 'scrypt' || !salt || !encoded) return false;
    const expected = Buffer.from(encoded, 'hex');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
