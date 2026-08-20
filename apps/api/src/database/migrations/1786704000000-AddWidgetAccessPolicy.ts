import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWidgetAccessPolicy1786704000000 implements MigrationInterface {
  name = 'AddWidgetAccessPolicy1786704000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "enabled" boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "allowedDomains" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "chat_widgets" DROP COLUMN IF EXISTS "allowedDomains"');
    await queryRunner.query('ALTER TABLE "chat_widgets" DROP COLUMN IF EXISTS "enabled"');
  }
}
