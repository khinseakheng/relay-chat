import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorageAttachments1786698000000 implements MigrationInterface {
  name = 'AddStorageAttachments1786698000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachmentUrl" text');
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachmentKey" varchar');
    await queryRunner.query('ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachmentSize" integer');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN IF EXISTS "attachmentSize"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN IF EXISTS "attachmentKey"');
    await queryRunner.query('ALTER TABLE "messages" DROP COLUMN IF EXISTS "attachmentUrl"');
  }
}
