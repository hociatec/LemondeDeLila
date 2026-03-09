"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatEditWindowSeconds1767900000000", {
    enumerable: true,
    get: function() {
        return ChatEditWindowSeconds1767900000000;
    }
});
let ChatEditWindowSeconds1767900000000 = class ChatEditWindowSeconds1767900000000 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE \`chat_settings\`
      ADD COLUMN \`edit_window_seconds\` int NOT NULL DEFAULT 300;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`chat_settings\` DROP COLUMN \`edit_window_seconds\`;`);
    }
    constructor(){
        this.name = 'ChatEditWindowSeconds1767900000000';
    }
};
