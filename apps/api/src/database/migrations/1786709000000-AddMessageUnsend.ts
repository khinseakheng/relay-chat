import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageUnsend1786709000000 implements MigrationInterface {
  name = 'AddMessageUnsend1786709000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderUserId" uuid');
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP');
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_messages_sender_user" ON "messages" ("senderUserId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_messages_sender_user"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN IF EXISTS "deletedAt"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN IF EXISTS "senderUserId"');
  }
}
