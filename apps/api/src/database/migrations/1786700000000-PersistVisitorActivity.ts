import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersistVisitorActivity1786700000000 implements MigrationInterface {
  name = 'PersistVisitorActivity1786700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "conversations" DROP COLUMN IF EXISTS "lastSeenAt"');
  }
}
