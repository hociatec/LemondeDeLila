import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class ChatSettings1735600000000 implements MigrationInterface {
  name = 'ChatSettings1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('chat_settings'))) {
      await queryRunner.createTable(
        new Table({
          name: 'chat_settings',
          columns: [
            { name: 'id', type: 'tinyint', isPrimary: true },
            { name: 'chat_history_limit', type: 'int', default: 200 },
          ],
        }),
        true,
      );
    }

    const existing = (await queryRunner.query(
      'SELECT id FROM chat_settings WHERE id = 1 LIMIT 1',
    )) as Array<{ id: number }>;
    if (existing.length === 0) {
      await queryRunner.query(
        'INSERT INTO chat_settings (id, chat_history_limit) VALUES (1, ?)',
        [200],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('chat_settings', true);
  }
}
