"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatSettings1735600000000", {
    enumerable: true,
    get: function() {
        return ChatSettings1735600000000;
    }
});
const _typeorm = require("typeorm");
let ChatSettings1735600000000 = class ChatSettings1735600000000 {
    async up(queryRunner) {
        if (!await queryRunner.hasTable('chat_settings')) {
            await queryRunner.createTable(new _typeorm.Table({
                name: 'chat_settings',
                columns: [
                    {
                        name: 'id',
                        type: 'tinyint',
                        isPrimary: true
                    },
                    {
                        name: 'chat_history_limit',
                        type: 'int',
                        default: 200
                    }
                ]
            }), true);
        }
        const existing = await queryRunner.query('SELECT id FROM chat_settings WHERE id = 1 LIMIT 1');
        if (existing.length === 0) {
            await queryRunner.query('INSERT INTO chat_settings (id, chat_history_limit) VALUES (1, ?)', [
                200
            ]);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('chat_settings', true);
    }
    constructor(){
        this.name = 'ChatSettings1735600000000';
    }
};
