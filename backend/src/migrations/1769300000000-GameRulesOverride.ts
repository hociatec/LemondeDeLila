import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class GameRulesOverride1769300000000 implements MigrationInterface {
  name = 'GameRulesOverride1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'game_catalog_overrides',
      new TableColumn({
        name: 'rules',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('game_catalog_overrides', 'rules');
  }
}
