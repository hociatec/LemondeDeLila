"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddBotDelaySettings1770000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddBotDelaySettings1770000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('bot_settings', new typeorm_1.TableColumn({
            name: 'bot_start_delay_ms',
            type: 'int',
            isNullable: false,
            default: '4000',
        }));
        await queryRunner.addColumn('bot_settings', new typeorm_1.TableColumn({
            name: 'bot_draw_delay_ms',
            type: 'int',
            isNullable: false,
            default: '4000',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('bot_settings', 'bot_draw_delay_ms');
        await queryRunner.dropColumn('bot_settings', 'bot_start_delay_ms');
    }
}
exports.AddBotDelaySettings1770000000000 = AddBotDelaySettings1770000000000;
//# sourceMappingURL=1770000000000-AddBotDelaySettings.js.map