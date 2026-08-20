import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWidgetAvailability1786705000000 implements MigrationInterface {
  name = 'AddWidgetAvailability1786705000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "availabilityMode" varchar NOT NULL DEFAULT 'auto'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "timezone" varchar NOT NULL DEFAULT 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "businessHours" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "holidays" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      'ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "offlineFormEnabled" boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "offlineMessage" varchar NOT NULL DEFAULT 'We are currently offline. Leave a message and we will get back to you.'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "expectedResponseTime" varchar NOT NULL DEFAULT 'Typically replies within a few minutes'`,
    );
    await queryRunner.query(
      'ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "maxActiveConversationsPerAgent" integer NOT NULL DEFAULT 0',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'maxActiveConversationsPerAgent',
      'expectedResponseTime',
      'offlineMessage',
      'offlineFormEnabled',
      'holidays',
      'businessHours',
      'timezone',
      'availabilityMode',
    ]) {
      await queryRunner.query(`ALTER TABLE "chat_widgets" DROP COLUMN IF EXISTS "${column}"`);
    }
  }
}
