import type { QueryRunner } from 'typeorm';
import { MigrationInterface } from 'typeorm';

/**
 * Suppression totale du jeu `loup-garou` de la base de données.
 * - Supprime les rooms (tables) correspondantes
 * - Supprime overrides/assignations/catalogue et stats associées
 *
 * NOTE: migration destructive (down = no-op).
 */
export class PurgeLoupGarouFromDb1768300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const gameType = 'loup-garou';

    if (await queryRunner.hasTable('rooms')) {
      await queryRunner.query('DELETE FROM rooms WHERE game_type = ?', [
        gameType,
      ]);
    }

    if (await queryRunner.hasTable('game_category_assignments')) {
      await queryRunner.query(
        'DELETE FROM game_category_assignments WHERE game_type = ?',
        [gameType],
      );
    }

    if (await queryRunner.hasTable('game_catalog_overrides')) {
      await queryRunner.query(
        'DELETE FROM game_catalog_overrides WHERE game_type = ?',
        [gameType],
      );
    }

    if (await queryRunner.hasTable('game_matches')) {
      await queryRunner.query('DELETE FROM game_matches WHERE game_type = ?', [
        gameType,
      ]);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op (suppression irréversible)
  }
}

