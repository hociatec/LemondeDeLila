import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexRecoverableGameSessions1790035300000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE game_sessions
        ADD COLUMN recovery_pending TINYINT GENERATED ALWAYS AS (
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(state, '$.status')) <> 'finished', 0)
        ) STORED,
        ADD INDEX idx_game_sessions_recovery (recovery_pending, room_id, game_type)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE game_sessions
        DROP INDEX idx_game_sessions_recovery,
        DROP COLUMN recovery_pending
    `);
  }
}
