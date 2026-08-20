import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWidgetLauncherIcon1786707000000 implements MigrationInterface {
  name = 'AddWidgetLauncherIcon1786707000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "launcherIcon" varchar NOT NULL DEFAULT 'sparkle'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "chat_widgets" DROP COLUMN IF EXISTS "launcherIcon"');
  }
}
