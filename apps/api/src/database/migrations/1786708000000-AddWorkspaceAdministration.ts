import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspaceAdministration1786708000000 implements MigrationInterface {
  name = 'AddWorkspaceAdministration1786708000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "attachmentMaxSizeMb" integer NOT NULL DEFAULT 5',
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "attachmentAllowedTypes" jsonb NOT NULL DEFAULT '["images","pdf","documents","spreadsheets","archives","text"]'::jsonb`,
    );
    await queryRunner.query(
      'ALTER TABLE "workspace_members" ADD COLUMN IF NOT EXISTS "sessionVersion" integer NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE "workspace_invitations" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP',
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "workspace_audit_logs" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL,
      "actorUserId" uuid, "actorName" varchar NOT NULL, "action" varchar NOT NULL,
      "targetType" varchar, "targetId" varchar, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workspace_audit_logs" PRIMARY KEY ("id"),
      CONSTRAINT "FK_workspace_audit_logs_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_workspace_audit_logs_actor" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_workspace_audit_logs_workspace_created" ON "workspace_audit_logs" ("workspaceId", "createdAt")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "workspace_audit_logs"');
    await queryRunner.query('ALTER TABLE "workspace_invitations" DROP COLUMN IF EXISTS "canceledAt"');
    await queryRunner.query('ALTER TABLE "workspace_members" DROP COLUMN IF EXISTS "sessionVersion"');
    await queryRunner.query('ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "attachmentAllowedTypes"');
    await queryRunner.query('ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "attachmentMaxSizeMb"');
  }
}
