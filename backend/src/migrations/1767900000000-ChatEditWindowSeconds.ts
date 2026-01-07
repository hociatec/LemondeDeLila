import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatEditWindowSeconds1767900000000 implements MigrationInterface {
  name = 'ChatEditWindowSeconds1767900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`chat_settings\`
      ADD COLUMN \`edit_window_seconds\` int NOT NULL DEFAULT 300;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`chat_settings\` DROP COLUMN \`edit_window_seconds\`;`,
    );
  }
}
