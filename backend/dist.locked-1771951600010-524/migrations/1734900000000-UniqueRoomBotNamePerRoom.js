"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueRoomBotNamePerRoom1734900000000 = void 0;
const typeorm_1 = require("typeorm");
class UniqueRoomBotNamePerRoom1734900000000 {
    name = 'UniqueRoomBotNamePerRoom1734900000000';
    async up(queryRunner) {
        await queryRunner.query(`
      DELETE rb1
      FROM room_bots rb1
      INNER JOIN room_bots rb2
        ON rb1.room_id = rb2.room_id
        AND rb1.name = rb2.name
        AND rb1.id > rb2.id
    `);
        await queryRunner.createIndex('room_bots', new typeorm_1.TableIndex({
            name: 'uniq_room_bots_room_name',
            columnNames: ['room_id', 'name'],
            isUnique: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('room_bots', 'uniq_room_bots_room_name');
    }
}
exports.UniqueRoomBotNamePerRoom1734900000000 = UniqueRoomBotNamePerRoom1734900000000;
//# sourceMappingURL=1734900000000-UniqueRoomBotNamePerRoom.js.map