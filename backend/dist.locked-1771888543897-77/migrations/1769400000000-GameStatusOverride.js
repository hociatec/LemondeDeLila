"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStatusOverride1769400000000 = void 0;
const typeorm_1 = require("typeorm");
class GameStatusOverride1769400000000 {
    name = 'GameStatusOverride1769400000000';
    async up(queryRunner) {
        const table = await queryRunner.getTable('game_catalog_overrides');
        const hasStatus = table?.columns?.some((c) => c.name === 'status');
        if (hasStatus)
            return;
        await queryRunner.addColumn('game_catalog_overrides', new typeorm_1.TableColumn({
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('game_catalog_overrides');
        const hasStatus = table?.columns?.some((c) => c.name === 'status');
        if (!hasStatus)
            return;
        await queryRunner.dropColumn('game_catalog_overrides', 'status');
    }
}
exports.GameStatusOverride1769400000000 = GameStatusOverride1769400000000;
//# sourceMappingURL=1769400000000-GameStatusOverride.js.map