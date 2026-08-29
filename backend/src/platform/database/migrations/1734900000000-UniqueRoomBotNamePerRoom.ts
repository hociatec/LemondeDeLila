import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class UniqueRoomBotNamePerRoom1734900000000 implements MigrationInterface {
  name = 'UniqueRoomBotNamePerRoom1734900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rb1
      FROM room_bots rb1
      INNER JOIN room_bots rb2
        ON rb1.room_id = rb2.room_id
        AND rb1.name = rb2.name
        AND rb1.id > rb2.id
    `);
    await queryRunner.createIndex(
      'room_bots',
      new TableIndex({
        name: 'uniq_room_bots_room_name',
        columnNames: ['room_id', 'name'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('room_bots', 'uniq_room_bots_room_name');
  }
}
