"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddRoomRunId1767700000000", {
    enumerable: true,
    get: function() {
        return AddRoomRunId1767700000000;
    }
});
let AddRoomRunId1767700000000 = class AddRoomRunId1767700000000 {
    async up(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` ADD COLUMN `run_id` int NOT NULL DEFAULT 0');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE `rooms` DROP COLUMN `run_id`');
    }
    constructor(){
        this.name = 'AddRoomRunId1767700000000';
    }
};
