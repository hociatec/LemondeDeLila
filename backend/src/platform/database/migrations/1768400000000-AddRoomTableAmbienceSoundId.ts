import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomTableAmbienceSoundId1768400000000 implements MigrationInterface {
  name = 'AddRoomTableAmbienceSoundId1768400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `rooms` ADD COLUMN `table_ambience_sound_id` varchar(50) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `rooms` DROP COLUMN `table_ambience_sound_id`',
    );
  }
}
