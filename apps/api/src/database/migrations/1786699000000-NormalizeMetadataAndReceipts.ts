import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeMetadataAndReceipts1786699000000 implements MigrationInterface {
  name = 'NormalizeMetadataAndReceipts1786699000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP');
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "conversation_tags" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "conversationId" uuid NOT NULL,
      "name" varchar NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_conversation_tags" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_conversation_tags_name" UNIQUE ("conversationId", "name"),
      CONSTRAINT "FK_conversation_tags_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "conversation_notes" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(), "conversationId" uuid NOT NULL,
      "text" text NOT NULL, "author" varchar NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_conversation_notes" PRIMARY KEY ("id"),
      CONSTRAINT "FK_conversation_notes_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_conversation_notes_created" ON "conversation_notes" ("conversationId", "createdAt")',
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "presence_sessions" (
      "id" varchar NOT NULL, "conversationId" uuid NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL, "lastSeenAt" TIMESTAMP NOT NULL,
      CONSTRAINT "PK_presence_sessions" PRIMARY KEY ("id"),
      CONSTRAINT "FK_presence_sessions_conversation" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_presence_expiry" ON "presence_sessions" ("conversationId", "expiresAt")',
    );

    if (await queryRunner.hasColumn('conversations', 'tags')) {
      await queryRunner.query(`INSERT INTO "conversation_tags" ("conversationId", "name")
        SELECT conversation."id", tag.name FROM "conversations" conversation
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(NULLIF(conversation."tags", ''), '[]')::jsonb) tag(name)
        ON CONFLICT DO NOTHING`);
    }
    if (await queryRunner.hasColumn('conversations', 'notes')) {
      await queryRunner.query(`INSERT INTO "conversation_notes" ("conversationId", "text", "author", "createdAt")
        SELECT conversation."id", note.item->>'text', COALESCE(note.item->>'author', 'Unknown'),
          COALESCE(NULLIF(note.item->>'createdAt', '')::timestamp, now())
        FROM "conversations" conversation
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(NULLIF(conversation."notes", ''), '[]')::jsonb) note(item)`);
    }
    await queryRunner.query('ALTER TABLE "conversations" DROP COLUMN IF EXISTS "tags"');
    await queryRunner.query('ALTER TABLE "conversations" DROP COLUMN IF EXISTS "notes"');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "tags" text NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(`UPDATE "conversations" conversation SET "tags" = COALESCE(
      (SELECT json_agg(tag."name")::text FROM "conversation_tags" tag WHERE tag."conversationId" = conversation."id"), '[]')`);
    await queryRunner.query(`UPDATE "conversations" conversation SET "notes" = COALESCE(
      (SELECT json_agg(json_build_object('id', note."id", 'text', note."text", 'author', note."author", 'createdAt', note."createdAt"))::text
       FROM "conversation_notes" note WHERE note."conversationId" = conversation."id"), '[]')`);
    await queryRunner.query('DROP TABLE IF EXISTS "presence_sessions"');
    await queryRunner.query('DROP TABLE IF EXISTS "conversation_notes"');
    await queryRunner.query('DROP TABLE IF EXISTS "conversation_tags"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN IF EXISTS "readAt"');
  }
}
