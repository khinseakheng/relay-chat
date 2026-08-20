import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthenticatedWidgetSessions1787111000000 implements MigrationInterface {
  name = 'AddAuthenticatedWidgetSessions1787111000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD "authenticationMode" character varying NOT NULL DEFAULT 'public'`,
    );
    await queryRunner.query(`ALTER TABLE "conversations" ADD "externalUserId" character varying`);
    await queryRunner.query(`ALTER TABLE "conversations" ADD "authenticated" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`
      CREATE TABLE "workspace_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "widgetId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "prefix" character varying NOT NULL,
        "secretHash" character varying NOT NULL,
        "scopes" jsonb NOT NULL DEFAULT '["widget:sessions:create"]'::jsonb,
        "createdBy" uuid NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "lastUsedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspace_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_workspace_api_keys_prefix" UNIQUE ("prefix")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_workspace_api_keys_workspace_created" ON "workspace_api_keys" ("workspaceId", "createdAt")`,
    );
    await queryRunner.query(`
      CREATE TABLE "widget_bootstrap_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "jtiHash" character varying NOT NULL,
        "workspaceId" uuid NOT NULL,
        "widgetId" uuid NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "usedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_widget_bootstrap_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_widget_bootstrap_tokens_jti" UNIQUE ("jtiHash")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_widget_bootstrap_tokens_expires" ON "widget_bootstrap_tokens" ("expiresAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_widget_bootstrap_tokens_expires"`);
    await queryRunner.query(`DROP TABLE "widget_bootstrap_tokens"`);
    await queryRunner.query(`DROP INDEX "IDX_workspace_api_keys_workspace_created"`);
    await queryRunner.query(`DROP TABLE "workspace_api_keys"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "authenticated"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "externalUserId"`);
    await queryRunner.query(`ALTER TABLE "chat_widgets" DROP COLUMN "authenticationMode"`);
  }
}
