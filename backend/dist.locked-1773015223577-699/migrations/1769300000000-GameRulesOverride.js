"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameRulesOverride1769300000000", {
    enumerable: true,
    get: function() {
        return GameRulesOverride1769300000000;
    }
});
const _typeorm = require("typeorm");
let GameRulesOverride1769300000000 = class GameRulesOverride1769300000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('game_catalog_overrides', new _typeorm.TableColumn({
            name: 'rules',
            type: 'text',
            isNullable: true
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('game_catalog_overrides', 'rules');
    }
    constructor(){
        this.name = 'GameRulesOverride1769300000000';
    }
};
