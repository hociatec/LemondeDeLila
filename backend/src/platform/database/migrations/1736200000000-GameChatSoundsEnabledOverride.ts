import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class GameChatSoundsEnabledOverride1736200000000 implements MigrationInterface {
  name = 'GameChatSoundsEnabledOverride1736200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'game_catalog_overrides',
      new TableColumn({
        name: 'chat_sounds_enabled',
        type: 'boolean',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(
      'game_catalog_overrides',
      'chat_sounds_enabled',
    );
  }
}
