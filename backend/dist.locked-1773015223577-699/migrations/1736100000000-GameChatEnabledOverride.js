"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameChatEnabledOverride1736100000000", {
    enumerable: true,
    get: function() {
        return GameChatEnabledOverride1736100000000;
    }
});
const _typeorm = require("typeorm");
let GameChatEnabledOverride1736100000000 = class GameChatEnabledOverride1736100000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('game_catalog_overrides', new _typeorm.TableColumn({
            name: 'chat_enabled',
            type: 'boolean',
            isNullable: true
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('game_catalog_overrides', 'chat_enabled');
    }
    constructor(){
        this.name = 'GameChatEnabledOverride1736100000000';
    }
};
