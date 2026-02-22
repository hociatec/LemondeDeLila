"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRulesOverride1769300000000 = void 0;
const typeorm_1 = require("typeorm");
class GameRulesOverride1769300000000 {
    name = 'GameRulesOverride1769300000000';
    async up(queryRunner) {
        await queryRunner.addColumn('game_catalog_overrides', new typeorm_1.TableColumn({
            name: 'rules',
            type: 'text',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('game_catalog_overrides', 'rules');
    }
}
exports.GameRulesOverride1769300000000 = GameRulesOverride1769300000000;
//# sourceMappingURL=1769300000000-GameRulesOverride.js.map