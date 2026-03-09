"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatBanFields1735400000000", {
    enumerable: true,
    get: function() {
        return ChatBanFields1735400000000;
    }
});
const _typeorm = require("typeorm");
let ChatBanFields1735400000000 = class ChatBanFields1735400000000 {
    async up(queryRunner) {
        await queryRunner.addColumns('users', [
            new _typeorm.TableColumn({
                name: 'chat_banned_until',
                type: 'datetime',
                isNullable: true
            }),
            new _typeorm.TableColumn({
                name: 'chat_ban_reason',
                type: 'varchar',
                length: '255',
                isNullable: true
            })
        ]);
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('users', 'chat_ban_reason');
        await queryRunner.dropColumn('users', 'chat_banned_until');
    }
    constructor(){
        this.name = 'ChatBanFields1735400000000';
    }
};
