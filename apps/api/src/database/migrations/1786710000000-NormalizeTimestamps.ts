import { MigrationInterface, QueryRunner } from 'typeorm';

const TIMESTAMP_COLUMNS: Record<string, string[]> = {
  users: ['createdAt'],
  workspaces: ['createdAt'],
  workspace_members: ['createdAt'],
  chat_widgets: ['createdAt'],
  workspace_invitations: ['expiresAt', 'acceptedAt', 'canceledAt', 'createdAt'],
  workspace_audit_logs: ['createdAt'],
  conversations: ['startedAt', 'lastSeenAt'],
  messages: ['createdAt', 'readAt', 'deletedAt'],
  presence_sessions: ['expiresAt', 'lastSeenAt'],
  conversation_tags: ['createdAt'],
  conversation_notes: ['createdAt'],
};

export class NormalizeTimestamps1786710000000 implements MigrationInterface {
  name = 'NormalizeTimestamps1786710000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, columns] of Object.entries(TIMESTAMP_COLUMNS)) {
      for (const column of columns) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamptz USING "${column}" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, columns] of Object.entries(TIMESTAMP_COLUMNS)) {
      for (const column of columns) {
        await queryRunner.query(
          `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamp USING "${column}" AT TIME ZONE 'UTC'`,
        );
      }
    }
  }
}
