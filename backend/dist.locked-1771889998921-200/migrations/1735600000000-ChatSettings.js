"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSettings1735600000000 = void 0;
const typeorm_1 = require("typeorm");
class ChatSettings1735600000000 {
    name = 'ChatSettings1735600000000';
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('chat_settings'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'chat_settings',
                columns: [
                    { name: 'id', type: 'tinyint', isPrimary: true },
                    { name: 'chat_history_limit', type: 'int', default: 200 },
                ],
            }), true);
        }
        const existing = (await queryRunner.query('SELECT id FROM chat_settings WHERE id = 1 LIMIT 1'));
        if (existing.length === 0) {
            await queryRunner.query('INSERT INTO chat_settings (id, chat_history_limit) VALUES (1, ?)', [200]);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('chat_settings', true);
    }
}
exports.ChatSettings1735600000000 = ChatSettings1735600000000;
//# sourceMappingURL=1735600000000-ChatSettings.js.map