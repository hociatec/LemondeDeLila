"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRoomRunId1767700000000 = void 0;
class AddRoomRunId1767700000000 {
    name = 'AddRoomRunId1767700000000';
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` ADD COLUMN `run_id` int NOT NULL DEFAULT 0');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` DROP COLUMN `run_id`');
    }
}
exports.AddRoomRunId1767700000000 = AddRoomRunId1767700000000;
//# sourceMappingURL=1767700000000-AddRoomRunId.js.map