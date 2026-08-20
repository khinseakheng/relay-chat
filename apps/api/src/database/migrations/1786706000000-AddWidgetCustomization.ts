import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWidgetCustomization1786706000000 implements MigrationInterface {
  name = 'AddWidgetCustomization1786706000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "greeting" varchar NOT NULL DEFAULT 'Tell us what you need. We’re happy to help.'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "welcomeMessage" varchar NOT NULL DEFAULT 'Hi there 👋 How can we help today?'`,
    );
    await queryRunner.query('ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "logoUrl" text');
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "position" varchar NOT NULL DEFAULT 'bottom-right'`,
    );
    await queryRunner.query(
      'ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "offsetX" integer NOT NULL DEFAULT 18',
    );
    await queryRunner.query(
      'ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "offsetY" integer NOT NULL DEFAULT 18',
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "theme" varchar NOT NULL DEFAULT 'light'`,
    );
    await queryRunner.query(
      'ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "showOnMobile" boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "language" varchar NOT NULL DEFAULT 'en'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "preChatFields" jsonb NOT NULL DEFAULT '{"name":{"enabled":true,"required":true},"email":{"enabled":true,"required":false}}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_widgets" ADD COLUMN IF NOT EXISTS "customFields" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "customFields" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "conversations" DROP COLUMN IF EXISTS "customFields"');
    for (const column of [
      'customFields',
      'preChatFields',
      'language',
      'showOnMobile',
      'theme',
      'offsetY',
      'offsetX',
      'position',
      'logoUrl',
      'welcomeMessage',
      'greeting',
    ]) {
      await queryRunner.query(`ALTER TABLE "chat_widgets" DROP COLUMN IF EXISTS "${column}"`);
    }
  }
}
