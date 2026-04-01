"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PurgeLoupGarouFromDb1768300000000", {
    enumerable: true,
    get: function() {
        return PurgeLoupGarouFromDb1768300000000;
    }
});
let PurgeLoupGarouFromDb1768300000000 = class PurgeLoupGarouFromDb1768300000000 {
    async up(queryRunner) {
        const gameType = 'loup-garou';
        if (await queryRunner.hasTable('rooms')) {
            await queryRunner.query('DELETE FROM rooms WHERE game_type = ?', [
                gameType
            ]);
        }
        if (await queryRunner.hasTable('game_category_assignments')) {
            await queryRunner.query('DELETE FROM game_category_assignments WHERE game_type = ?', [
                gameType
            ]);
        }
        if (await queryRunner.hasTable('game_catalog_overrides')) {
            await queryRunner.query('DELETE FROM game_catalog_overrides WHERE game_type = ?', [
                gameType
            ]);
        }
        if (await queryRunner.hasTable('game_matches')) {
            await queryRunner.query('DELETE FROM game_matches WHERE game_type = ?', [
                gameType
            ]);
        }
    }
    async down(_queryRunner) {
    // no-op (suppression irréversible)
    }
};
