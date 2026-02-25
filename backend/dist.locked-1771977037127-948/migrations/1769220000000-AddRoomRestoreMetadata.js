"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRoomRestoreMetadata1769220000000 = void 0;
class AddRoomRestoreMetadata1769220000000 {
    name = 'AddRoomRestoreMetadata1769220000000';
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
}
exports.AddRoomRestoreMetadata1769220000000 = AddRoomRestoreMetadata1769220000000;
//# sourceMappingURL=1769220000000-AddRoomRestoreMetadata.js.map