import { MigrationInterface, QueryRunner } from 'typeorm';

export class DetachLegacyConversations1786702000000 implements MigrationInterface {
  name = 'DetachLegacyConversations1786702000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "conversations" conversation
      SET "workspaceId" = NULL
      FROM "workspaces" workspace
      WHERE conversation."workspaceId" = workspace."id"
        AND conversation."startedAt" < workspace."createdAt"`);
  }

  async down(): Promise<void> {
    // Legacy ownership cannot be reconstructed safely without explicit user input.
  }
}
