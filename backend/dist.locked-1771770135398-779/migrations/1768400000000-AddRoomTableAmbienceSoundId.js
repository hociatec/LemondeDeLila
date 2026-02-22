"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRoomTableAmbienceSoundId1768400000000 = void 0;
class AddRoomTableAmbienceSoundId1768400000000 {
    name = 'AddRoomTableAmbienceSoundId1768400000000';
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` ADD COLUMN `table_ambience_sound_id` varchar(50) NULL');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` DROP COLUMN `table_ambience_sound_id`');
    }
}
exports.AddRoomTableAmbienceSoundId1768400000000 = AddRoomTableAmbienceSoundId1768400000000;
//# sourceMappingURL=1768400000000-AddRoomTableAmbienceSoundId.js.map