import type { MigrationInterface, QueryRunner } from 'typeorm';

type DuplicateActiveRoom = { room_id: number; occurrences: number };

export class EnforceSingleActiveGameMatch1770800000000 implements MigrationInterface {
  name = 'EnforceSingleActiveGameMatch1770800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE game_matches matches
       LEFT JOIN rooms room ON room.id = matches.room_id
       SET matches.ended_at = CURRENT_TIMESTAMP,
           matches.ended_reason = COALESCE(matches.ended_reason, 'restart')
       WHERE matches.ended_at IS NULL
         AND room.id IS NULL`,
    );
    const duplicates = (await queryRunner.query(
      `SELECT room_id, COUNT(*) AS occurrences
       FROM game_matches
       WHERE ended_at IS NULL
       GROUP BY room_id
       HAVING COUNT(*) > 1
       LIMIT 1`,
    )) as DuplicateActiveRoom[];
    if (duplicates.length > 0) {
      throw new Error(
        `Plusieurs matchs actifs existent pour la room ${duplicates[0].room_id}`,
      );
    }
    await queryRunner.query(
      'ALTER TABLE `game_matches` ADD COLUMN `active_room_id` int GENERATED ALWAYS AS (IF(`ended_at` IS NULL, `room_id`, NULL)) STORED, ADD UNIQUE INDEX `uniq_game_matches_active_room` (`active_room_id`)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `game_matches` DROP INDEX `uniq_game_matches_active_room`, DROP COLUMN `active_room_id`',
    );
  }
}
