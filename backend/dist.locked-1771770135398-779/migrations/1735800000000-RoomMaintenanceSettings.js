"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomMaintenanceSettings1735800000000 = void 0;
const typeorm_1 = require("typeorm");
class RoomMaintenanceSettings1735800000000 {
    name = 'RoomMaintenanceSettings1735800000000';
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('room_maintenance_settings'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'room_maintenance_settings',
                columns: [
                    { name: 'id', type: 'tinyint', isPrimary: true },
                    { name: 'auto_cleanup_enabled', type: 'boolean', default: false },
                    {
                        name: 'auto_cleanup_older_than_minutes',
                        type: 'int',
                        default: 60,
                    },
                    {
                        name: 'auto_cleanup_interval_seconds',
                        type: 'int',
                        default: 300,
                    },
                    { name: 'auto_cleanup_limit', type: 'int', default: 1000 },
                ],
            }), true);
        }
        const existing = (await queryRunner.query('SELECT id FROM room_maintenance_settings WHERE id = 1 LIMIT 1'));
        if (existing.length === 0) {
            await queryRunner.query(`INSERT INTO room_maintenance_settings
          (id, auto_cleanup_enabled, auto_cleanup_older_than_minutes, auto_cleanup_interval_seconds, auto_cleanup_limit)
         VALUES (1, ?, ?, ?, ?)`, [false, 60, 300, 1000]);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('room_maintenance_settings', true);
    }
}
exports.RoomMaintenanceSettings1735800000000 = RoomMaintenanceSettings1735800000000;
//# sourceMappingURL=1735800000000-RoomMaintenanceSettings.js.map