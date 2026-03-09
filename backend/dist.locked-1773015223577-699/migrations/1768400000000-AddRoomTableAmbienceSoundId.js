"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddRoomTableAmbienceSoundId1768400000000", {
    enumerable: true,
    get: function() {
        return AddRoomTableAmbienceSoundId1768400000000;
    }
});
let AddRoomTableAmbienceSoundId1768400000000 = class AddRoomTableAmbienceSoundId1768400000000 {
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` ADD COLUMN `table_ambience_sound_id` varchar(50) NULL');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` DROP COLUMN `table_ambience_sound_id`');
    }
    constructor(){
        this.name = 'AddRoomTableAmbienceSoundId1768400000000';
    }
};
