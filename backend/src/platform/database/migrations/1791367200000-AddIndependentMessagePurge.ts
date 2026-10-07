import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndependentMessagePurge1791367200000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    for (const column of ['purged_by_sender_at', 'purged_by_recipient_at']) {
      if (!(await runner.hasColumn('messaging_private_messages', column))) {
        await runner.query(
          `ALTER TABLE messaging_private_messages ADD COLUMN ${column} DATETIME NULL`,
        );
      }
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    // Rolling back must never resurrect messages a participant already purged.
    const rows: unknown =
      await runner.query(`SELECT id FROM messaging_private_messages
      WHERE purged_by_sender_at IS NOT NULL OR purged_by_recipient_at IS NOT NULL LIMIT 1`);
    if (!Array.isArray(rows) || rows.length)
      throw new Error('Independent message purges prevent rollback');
    await runner.query(`ALTER TABLE messaging_private_messages
      DROP COLUMN purged_by_sender_at, DROP COLUMN purged_by_recipient_at`);
  }
}
