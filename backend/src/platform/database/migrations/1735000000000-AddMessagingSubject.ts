import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMessagingSubject1735000000000 implements MigrationInterface {
  name = 'AddMessagingSubject1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'messaging_private_messages',
      new TableColumn({
        name: 'subject',
        type: 'varchar',
        length: '200',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('messaging_private_messages', 'subject');
  }
}
