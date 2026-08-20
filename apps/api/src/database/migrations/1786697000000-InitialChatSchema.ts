import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialChatSchema1786697000000 implements MigrationInterface {
  name = 'InitialChatSchema1786697000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "conversations" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "siteId" varchar NOT NULL DEFAULT 'demo',
      "visitorName" varchar NOT NULL, "visitorEmail" varchar NOT NULL DEFAULT '',
      "visitorLocation" varchar NOT NULL DEFAULT 'Unknown location', "visitorBrowser" varchar NOT NULL DEFAULT 'Web visitor',
      "visitorInitials" varchar NOT NULL DEFAULT 'V', "status" varchar NOT NULL DEFAULT 'open',
      "unread" integer NOT NULL DEFAULT 0, "assignedTo" varchar NOT NULL DEFAULT 'Unassigned',
      "page" varchar NOT NULL DEFAULT '/', "tags" text NOT NULL DEFAULT '[]', "notes" text NOT NULL DEFAULT '[]',
      "startedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_conversations" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "messages" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "conversationId" uuid NOT NULL,
      "sender" varchar NOT NULL, "senderName" varchar NOT NULL, "text" text NOT NULL,
      "attachmentName" varchar, "attachmentMime" varchar, "attachmentData" text,
      "attachmentUrl" text, "attachmentKey" varchar, "attachmentSize" integer,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
      CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_messages_conversation" ON "messages" ("conversationId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_conversations_site_status" ON "conversations" ("siteId", "status")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "messages"');
    await queryRunner.query('DROP TABLE IF EXISTS "conversations"');
  }
}
