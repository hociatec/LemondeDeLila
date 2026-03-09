"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameChatSoundsEnabledOverride1736200000000", {
    enumerable: true,
    get: function() {
        return GameChatSoundsEnabledOverride1736200000000;
    }
});
const _typeorm = require("typeorm");
let GameChatSoundsEnabledOverride1736200000000 = class GameChatSoundsEnabledOverride1736200000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('game_catalog_overrides', new _typeorm.TableColumn({
            name: 'chat_sounds_enabled',
            type: 'boolean',
            isNullable: true
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('game_catalog_overrides', 'chat_sounds_enabled');
    }
    constructor(){
        this.name = 'GameChatSoundsEnabledOverride1736200000000';
    }
};
