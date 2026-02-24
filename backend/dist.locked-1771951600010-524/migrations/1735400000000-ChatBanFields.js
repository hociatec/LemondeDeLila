"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatBanFields1735400000000 = void 0;
const typeorm_1 = require("typeorm");
class ChatBanFields1735400000000 {
    name = 'ChatBanFields1735400000000';
    async up(queryRunner) {
        await queryRunner.addColumns('users', [
            new typeorm_1.TableColumn({
                name: 'chat_banned_until',
                type: 'datetime',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'chat_ban_reason',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
        ]);
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('users', 'chat_ban_reason');
        await queryRunner.dropColumn('users', 'chat_banned_until');
    }
}
exports.ChatBanFields1735400000000 = ChatBanFields1735400000000;
//# sourceMappingURL=1735400000000-ChatBanFields.js.map