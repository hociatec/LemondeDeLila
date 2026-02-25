"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameChatSoundsEnabledOverride1736200000000 = void 0;
const typeorm_1 = require("typeorm");
class GameChatSoundsEnabledOverride1736200000000 {
    name = 'GameChatSoundsEnabledOverride1736200000000';
    async up(queryRunner) {
        await queryRunner.addColumn('game_catalog_overrides', new typeorm_1.TableColumn({
            name: 'chat_sounds_enabled',
            type: 'boolean',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('game_catalog_overrides', 'chat_sounds_enabled');
    }
}
exports.GameChatSoundsEnabledOverride1736200000000 = GameChatSoundsEnabledOverride1736200000000;
//# sourceMappingURL=1736200000000-GameChatSoundsEnabledOverride.js.map