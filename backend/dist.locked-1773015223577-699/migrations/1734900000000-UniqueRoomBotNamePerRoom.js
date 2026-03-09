"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "UniqueRoomBotNamePerRoom1734900000000", {
    enumerable: true,
    get: function() {
        return UniqueRoomBotNamePerRoom1734900000000;
    }
});
const _typeorm = require("typeorm");
let UniqueRoomBotNamePerRoom1734900000000 = class UniqueRoomBotNamePerRoom1734900000000 {
    async up(queryRunner) {
        await queryRunner.query(`
      DELETE rb1
      FROM room_bots rb1
      INNER JOIN room_bots rb2
        ON rb1.room_id = rb2.room_id
        AND rb1.name = rb2.name
        AND rb1.id > rb2.id
    `);
        await queryRunner.createIndex('room_bots', new _typeorm.TableIndex({
            name: 'uniq_room_bots_room_name',
            columnNames: [
                'room_id',
                'name'
            ],
            isUnique: true
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('room_bots', 'uniq_room_bots_room_name');
    }
    constructor(){
        this.name = 'UniqueRoomBotNamePerRoom1734900000000';
    }
};
