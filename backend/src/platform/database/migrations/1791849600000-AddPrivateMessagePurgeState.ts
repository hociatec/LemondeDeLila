import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrivateMessagePurgeState1791849600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messaging_private_messages
        ADD COLUMN purged_by_sender_at DATETIME NULL,
        ADD COLUMN purged_by_recipient_at DATETIME NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messaging_private_messages
        DROP COLUMN purged_by_recipient_at,
        DROP COLUMN purged_by_sender_at
    `);
  }
}
