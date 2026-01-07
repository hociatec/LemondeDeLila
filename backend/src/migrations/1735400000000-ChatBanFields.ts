import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ChatBanFields1735400000000 implements MigrationInterface {
  name = 'ChatBanFields1735400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'chat_banned_until',
        type: 'datetime',
        isNullable: true,
      }),
      new TableColumn({
        name: 'chat_ban_reason',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'chat_ban_reason');
    await queryRunner.dropColumn('users', 'chat_banned_until');
  }
}
