import type { DataSourceOptions } from 'typeorm';
import {
  ConversationEntity,
  ConversationNoteEntity,
  ConversationTagEntity,
  MessageEntity,
  PresenceSessionEntity,
} from '../chat/entities';
import {
  ChatWidgetEntity,
  UserEntity,
  WorkspaceEntity,
  WorkspaceInvitationEntity,
  WorkspaceAuditLogEntity,
  WorkspaceMemberEntity,
  WorkspaceApiKeyEntity,
  WidgetBootstrapTokenEntity,
} from '../workspace/workspace.entities';

function numberFromEnvironment(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function createDatabaseConfig(options: {
  migrations: string[];
  synchronize: boolean;
}): DataSourceOptions {
  const useSsl = process.env.DB_SSL === 'true';

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: numberFromEnvironment('DB_PORT', 5432),
    username: process.env.DB_USER || 'relay',
    password: process.env.DB_PASSWORD || 'relay',
    database: process.env.DB_NAME || 'relay',
    ssl: useSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    entities: [
      ConversationEntity,
      MessageEntity,
      PresenceSessionEntity,
      ConversationTagEntity,
      ConversationNoteEntity,
      UserEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
      ChatWidgetEntity,
      WorkspaceInvitationEntity,
      WorkspaceAuditLogEntity,
      WorkspaceApiKeyEntity,
      WidgetBootstrapTokenEntity,
    ],
    migrations: options.migrations,
    migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
    synchronize: options.synchronize,
  };
}
