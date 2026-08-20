import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspacesAndInvitations1786701000000 implements MigrationInterface {
  name = 'AddWorkspacesAndInvitations1786701000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" varchar NOT NULL,
      "name" varchar NOT NULL, "passwordHash" varchar NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_users" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_users_email" UNIQUE ("email")
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "workspaces" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" varchar NOT NULL,
      "slug" varchar NOT NULL, "createdBy" uuid NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workspaces" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_workspaces_slug" UNIQUE ("slug"),
      CONSTRAINT "FK_workspaces_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "workspace_members" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL,
      "userId" uuid NOT NULL, "role" varchar NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workspace_members" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_workspace_members_user" UNIQUE ("workspaceId", "userId"),
      CONSTRAINT "FK_workspace_members_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_workspace_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "chat_widgets" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL,
      "siteId" varchar NOT NULL, "name" varchar NOT NULL, "title" varchar NOT NULL DEFAULT 'Chat with us',
      "color" varchar NOT NULL DEFAULT '#6557e8', "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_chat_widgets" PRIMARY KEY ("id"), CONSTRAINT "UQ_chat_widgets_site" UNIQUE ("siteId"),
      CONSTRAINT "FK_chat_widgets_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_chat_widgets_workspace" ON "chat_widgets" ("workspaceId")',
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "workspace_invitations" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "workspaceId" uuid NOT NULL,
      "email" varchar, "role" varchar NOT NULL, "tokenHash" varchar NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL, "acceptedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_workspace_invitations" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_workspace_invitations_token" UNIQUE ("tokenHash"),
      CONSTRAINT "FK_workspace_invitations_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_workspace_invitations_workspace" ON "workspace_invitations" ("workspaceId")',
    );
    await queryRunner.query('ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "workspaceId" uuid');
    await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_conversations_workspace"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_conversations_workspace" ON "conversations" ("workspaceId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "FK_conversations_workspace"',
    );
    await queryRunner.query('ALTER TABLE "conversations" DROP COLUMN IF EXISTS "workspaceId"');
    await queryRunner.query('DROP TABLE IF EXISTS "workspace_invitations"');
    await queryRunner.query('DROP TABLE IF EXISTS "chat_widgets"');
    await queryRunner.query('DROP TABLE IF EXISTS "workspace_members"');
    await queryRunner.query('DROP TABLE IF EXISTS "workspaces"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}
