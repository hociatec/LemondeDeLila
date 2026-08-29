import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddGameSessions1770200000000 implements MigrationInterface {
  name = 'AddGameSessions1770200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'game_sessions',
        columns: [
          {
            name: 'room_id',
            type: 'int',
            unsigned: true,
            isPrimary: true,
          },
          {
            name: 'game_type',
            type: 'varchar',
            length: '120',
            isPrimary: true,
          },
          { name: 'version', type: 'int', unsigned: true },
          { name: 'state', type: 'json' },
          { name: 'timeline', type: 'json' },
          {
            name: 'updated_at',
            type: 'datetime',
            precision: 3,
            default: 'CURRENT_TIMESTAMP(3)',
            onUpdate: 'CURRENT_TIMESTAMP(3)',
          },
        ],
        indices: [
          {
            name: 'IDX_game_sessions_room_updated',
            columnNames: ['room_id', 'updated_at'],
          },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('game_sessions', true);
  }
}
