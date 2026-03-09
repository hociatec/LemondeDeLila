"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddBotDelaySettings1770000000000", {
    enumerable: true,
    get: function() {
        return AddBotDelaySettings1770000000000;
    }
});
const _typeorm = require("typeorm");
let AddBotDelaySettings1770000000000 = class AddBotDelaySettings1770000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('bot_settings', new _typeorm.TableColumn({
            name: 'bot_start_delay_ms',
            type: 'int',
            isNullable: false,
            default: '4000'
        }));
        await queryRunner.addColumn('bot_settings', new _typeorm.TableColumn({
            name: 'bot_draw_delay_ms',
            type: 'int',
            isNullable: false,
            default: '4000'
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('bot_settings', 'bot_draw_delay_ms');
        await queryRunner.dropColumn('bot_settings', 'bot_start_delay_ms');
    }
};
