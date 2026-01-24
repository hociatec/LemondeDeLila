import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomRestoreMetadata1769220000000 implements MigrationInterface {
  name = 'AddRoomRestoreMetadata1769220000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rooms
        ADD COLUMN restored_from_snapshot_id varchar(64) NULL,
        ADD COLUMN restored_owner_user_id int NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rooms
        DROP COLUMN restored_from_snapshot_id,
        DROP COLUMN restored_owner_user_id
    `);
  }
}

