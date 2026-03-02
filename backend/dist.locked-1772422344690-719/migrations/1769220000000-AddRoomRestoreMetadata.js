"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AddRoomRestoreMetadata1769220000000", {
    enumerable: true,
    get: function() {
        return AddRoomRestoreMetadata1769220000000;
    }
});
let AddRoomRestoreMetadata1769220000000 = class AddRoomRestoreMetadata1769220000000 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE rooms
        ADD COLUMN restored_from_snapshot_id varchar(64) NULL,
        ADD COLUMN restored_owner_user_id int NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE rooms
        DROP COLUMN restored_from_snapshot_id,
        DROP COLUMN restored_owner_user_id
    `);
    }
    constructor(){
        this.name = 'AddRoomRestoreMetadata1769220000000';
    }
};
