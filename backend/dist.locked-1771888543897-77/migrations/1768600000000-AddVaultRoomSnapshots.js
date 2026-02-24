"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddVaultRoomSnapshots1768600000000 = void 0;
class AddVaultRoomSnapshots1768600000000 {
    name = 'AddVaultRoomSnapshots1768600000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vault_room_snapshots (
        id varchar(36) NOT NULL,
        owner_user_id int NOT NULL,
        name varchar(200) NOT NULL,
        game_type varchar(100) NOT NULL,
        room_name varchar(255) NOT NULL,
        players_label varchar(255) NOT NULL,
        snapshot_json longtext NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX idx_vault_room_snapshots_owner_created_at (owner_user_id, created_at)
      ) ENGINE=InnoDB;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS vault_room_snapshots`);
    }
}
exports.AddVaultRoomSnapshots1768600000000 = AddVaultRoomSnapshots1768600000000;
//# sourceMappingURL=1768600000000-AddVaultRoomSnapshots.js.map