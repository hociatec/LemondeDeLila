import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomRunId1767700000000 implements MigrationInterface {
  name = 'AddRoomRunId1767700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `rooms` ADD COLUMN `run_id` int NOT NULL DEFAULT 0",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `rooms` DROP COLUMN `run_id`");
  }
}

