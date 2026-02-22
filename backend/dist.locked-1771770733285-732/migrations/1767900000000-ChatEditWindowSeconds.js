"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatEditWindowSeconds1767900000000 = void 0;
class ChatEditWindowSeconds1767900000000 {
    name = 'ChatEditWindowSeconds1767900000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE \`chat_settings\`
      ADD COLUMN \`edit_window_seconds\` int NOT NULL DEFAULT 300;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`chat_settings\` DROP COLUMN \`edit_window_seconds\`;`);
    }
}
exports.ChatEditWindowSeconds1767900000000 = ChatEditWindowSeconds1767900000000;
//# sourceMappingURL=1767900000000-ChatEditWindowSeconds.js.map