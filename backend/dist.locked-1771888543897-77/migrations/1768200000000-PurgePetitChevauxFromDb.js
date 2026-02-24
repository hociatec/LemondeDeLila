"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurgePetitChevauxFromDb1768200000000 = void 0;
class PurgePetitChevauxFromDb1768200000000 {
    async up(queryRunner) {
        const legacyGameType = 'petit-chevaux';
        if (await queryRunner.hasTable('rooms')) {
            await queryRunner.query('DELETE FROM rooms WHERE game_type = ?', [
                legacyGameType,
            ]);
        }
        if (await queryRunner.hasTable('game_category_assignments')) {
            await queryRunner.query('DELETE FROM game_category_assignments WHERE game_type = ?', [legacyGameType]);
        }
        if (await queryRunner.hasTable('game_catalog_overrides')) {
            await queryRunner.query('DELETE FROM game_catalog_overrides WHERE game_type = ?', [legacyGameType]);
        }
        if (await queryRunner.hasTable('game_matches')) {
            await queryRunner.query('DELETE FROM game_matches WHERE game_type = ?', [
                legacyGameType,
            ]);
        }
    }
    async down(_queryRunner) {
    }
}
exports.PurgePetitChevauxFromDb1768200000000 = PurgePetitChevauxFromDb1768200000000;
//# sourceMappingURL=1768200000000-PurgePetitChevauxFromDb.js.map