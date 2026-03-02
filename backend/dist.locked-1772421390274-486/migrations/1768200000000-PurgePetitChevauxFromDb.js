"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PurgePetitChevauxFromDb1768200000000", {
    enumerable: true,
    get: function() {
        return PurgePetitChevauxFromDb1768200000000;
    }
});
let PurgePetitChevauxFromDb1768200000000 = class PurgePetitChevauxFromDb1768200000000 {
    async up(queryRunner) {
        const legacyGameType = 'petit-chevaux';
        // 1) Rooms (tables) + dépendances en cascade (participants/bots).
        if (await queryRunner.hasTable('rooms')) {
            await queryRunner.query('DELETE FROM rooms WHERE game_type = ?', [
                legacyGameType
            ]);
        }
        // 2) Overrides & assignments (catalogue/taverne).
        if (await queryRunner.hasTable('game_category_assignments')) {
            await queryRunner.query('DELETE FROM game_category_assignments WHERE game_type = ?', [
                legacyGameType
            ]);
        }
        if (await queryRunner.hasTable('game_catalog_overrides')) {
            await queryRunner.query('DELETE FROM game_catalog_overrides WHERE game_type = ?', [
                legacyGameType
            ]);
        }
        // 3) Stats.
        if (await queryRunner.hasTable('game_matches')) {
            await queryRunner.query('DELETE FROM game_matches WHERE game_type = ?', [
                legacyGameType
            ]);
        // game_match_players a un FK cascade vers game_matches -> rien d'autre à faire.
        }
    }
    async down(_queryRunner) {
    // no-op: suppression irréversible (données de rooms/stats).
    }
};
