import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class GameStatusOverride1769400000000 implements MigrationInterface {
  name = 'GameStatusOverride1769400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('game_catalog_overrides');
    const hasStatus = table?.columns?.some((c) => c.name === 'status');
    if (hasStatus) return;

    await queryRunner.addColumn(
      'game_catalog_overrides',
      new TableColumn({
        name: 'status',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('game_catalog_overrides');
    const hasStatus = table?.columns?.some((c) => c.name === 'status');
    if (!hasStatus) return;
    await queryRunner.dropColumn('game_catalog_overrides', 'status');
  }
}
