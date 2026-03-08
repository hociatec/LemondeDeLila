"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameStatusOverride1769400000000", {
    enumerable: true,
    get: function() {
        return GameStatusOverride1769400000000;
    }
});
const _typeorm = require("typeorm");
let GameStatusOverride1769400000000 = class GameStatusOverride1769400000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('game_catalog_overrides');
        const hasStatus = table?.columns?.some((c)=>c.name === 'status');
        if (hasStatus) return;
        await queryRunner.addColumn('game_catalog_overrides', new _typeorm.TableColumn({
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: true
        }));
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('game_catalog_overrides');
        const hasStatus = table?.columns?.some((c)=>c.name === 'status');
        if (!hasStatus) return;
        await queryRunner.dropColumn('game_catalog_overrides', 'status');
    }
    constructor(){
        this.name = 'GameStatusOverride1769400000000';
    }
};
