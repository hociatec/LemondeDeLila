"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameChatEnabledOverride1736100000000 = void 0;
const typeorm_1 = require("typeorm");
class GameChatEnabledOverride1736100000000 {
    name = 'GameChatEnabledOverride1736100000000';
    async up(queryRunner) {
        await queryRunner.addColumn('game_catalog_overrides', new typeorm_1.TableColumn({
            name: 'chat_enabled',
            type: 'boolean',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('game_catalog_overrides', 'chat_enabled');
    }
}
exports.GameChatEnabledOverride1736100000000 = GameChatEnabledOverride1736100000000;
//# sourceMappingURL=1736100000000-GameChatEnabledOverride.js.map