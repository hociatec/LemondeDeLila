import type { QueryRunner } from 'typeorm';
import { MigrationInterface } from 'typeorm';

/**
 * Purge les anciennes "tables" (rooms) utilisant l'ancien id de jeu `petit-chevaux`.
 * Objectif: supprimer toute référence legacy en base après renommage technique.
 *
 * NOTE: migration destructive (down = no-op).
 */
export class PurgePetitChevauxFromDb1768200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const legacyGameType = 'petit-chevaux';

    // 1) Rooms (tables) + dépendances en cascade (participants/bots).
    if (await queryRunner.hasTable('rooms')) {
      await queryRunner.query('DELETE FROM rooms WHERE game_type = ?', [
        legacyGameType,
      ]);
    }

    // 2) Overrides & assignments (catalogue/taverne).
    if (await queryRunner.hasTable('game_category_assignments')) {
      await queryRunner.query(
        'DELETE FROM game_category_assignments WHERE game_type = ?',
        [legacyGameType],
      );
    }
    if (await queryRunner.hasTable('game_catalog_overrides')) {
      await queryRunner.query(
        'DELETE FROM game_catalog_overrides WHERE game_type = ?',
        [legacyGameType],
      );
    }

    // 3) Stats.
    if (await queryRunner.hasTable('game_matches')) {
      await queryRunner.query('DELETE FROM game_matches WHERE game_type = ?', [
        legacyGameType,
      ]);
      // game_match_players a un FK cascade vers game_matches -> rien d'autre à faire.
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op: suppression irréversible (données de rooms/stats).
  }
}

