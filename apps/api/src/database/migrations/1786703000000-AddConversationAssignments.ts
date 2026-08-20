import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationAssignments1786703000000 implements MigrationInterface {
  name = 'AddConversationAssignments1786703000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "assignedMemberId" uuid');
    await queryRunner.query(`UPDATE "conversations" conversation
      SET "assignedMemberId" = member."id"
      FROM "workspace_members" member
      INNER JOIN "users" user_account ON user_account."id" = member."userId"
      WHERE conversation."workspaceId" = member."workspaceId"
        AND conversation."assignedTo" = user_account."name"
        AND conversation."assignedTo" <> 'Unassigned'`);
    await queryRunner.query(`ALTER TABLE "conversations"
      ADD CONSTRAINT "FK_conversations_assigned_member"
      FOREIGN KEY ("assignedMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_conversations_assigned_member" ON "conversations" ("assignedMemberId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_conversations_assigned_member"');
    await queryRunner.query(
      'ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "FK_conversations_assigned_member"',
    );
    await queryRunner.query('ALTER TABLE "conversations" DROP COLUMN IF EXISTS "assignedMemberId"');
  }
}
