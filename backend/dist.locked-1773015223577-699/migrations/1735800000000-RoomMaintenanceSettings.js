"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomMaintenanceSettings1735800000000", {
    enumerable: true,
    get: function() {
        return RoomMaintenanceSettings1735800000000;
    }
});
const _typeorm = require("typeorm");
let RoomMaintenanceSettings1735800000000 = class RoomMaintenanceSettings1735800000000 {
    async up(queryRunner) {
        if (!await queryRunner.hasTable('room_maintenance_settings')) {
            await queryRunner.createTable(new _typeorm.Table({
                name: 'room_maintenance_settings',
                columns: [
                    {
                        name: 'id',
                        type: 'tinyint',
                        isPrimary: true
                    },
                    {
                        name: 'auto_cleanup_enabled',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'auto_cleanup_older_than_minutes',
                        type: 'int',
                        default: 60
                    },
                    {
                        name: 'auto_cleanup_interval_seconds',
                        type: 'int',
                        default: 300
                    },
                    {
                        name: 'auto_cleanup_limit',
                        type: 'int',
                        default: 1000
                    }
                ]
            }), true);
        }
        const existing = await queryRunner.query('SELECT id FROM room_maintenance_settings WHERE id = 1 LIMIT 1');
        if (existing.length === 0) {
            await queryRunner.query(`INSERT INTO room_maintenance_settings
          (id, auto_cleanup_enabled, auto_cleanup_older_than_minutes, auto_cleanup_interval_seconds, auto_cleanup_limit)
         VALUES (1, ?, ?, ?, ?)`, [
                false,
                60,
                300,
                1000
            ]);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('room_maintenance_settings', true);
    }
    constructor(){
        this.name = 'RoomMaintenanceSettings1735800000000';
    }
};
