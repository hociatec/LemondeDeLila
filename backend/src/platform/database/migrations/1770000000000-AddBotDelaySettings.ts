import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBotDelaySettings1770000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'bot_settings',
      new TableColumn({
        name: 'bot_start_delay_ms',
        type: 'int',
        isNullable: false,
        default: '4000',
      }),
    );
    await queryRunner.addColumn(
      'bot_settings',
      new TableColumn({
        name: 'bot_draw_delay_ms',
        type: 'int',
        isNullable: false,
        default: '4000',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('bot_settings', 'bot_draw_delay_ms');
    await queryRunner.dropColumn('bot_settings', 'bot_start_delay_ms');
  }
}
