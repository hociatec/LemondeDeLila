import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class GameChatEnabledOverride1736100000000 implements MigrationInterface {
  name = 'GameChatEnabledOverride1736100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'game_catalog_overrides',
      new TableColumn({
        name: 'chat_enabled',
        type: 'boolean',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('game_catalog_overrides', 'chat_enabled');
  }
}
