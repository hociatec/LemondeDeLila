"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomMaintenanceSettingsEntity", {
    enumerable: true,
    get: function() {
        return RoomMaintenanceSettingsEntity;
    }
});
const _typeorm = require("typeorm");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let RoomMaintenanceSettingsEntity = class RoomMaintenanceSettingsEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'tinyint'
    }),
    _ts_metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'auto_cleanup_enabled',
        type: 'boolean',
        default: false
    }),
    _ts_metadata("design:type", Boolean)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupEnabled", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'auto_cleanup_older_than_minutes',
        type: 'int',
        default: 60
    }),
    _ts_metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupOlderThanMinutes", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'auto_cleanup_interval_seconds',
        type: 'int',
        default: 300
    }),
    _ts_metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupIntervalSeconds", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'auto_cleanup_limit',
        type: 'int',
        default: 1000
    }),
    _ts_metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupLimit", void 0);
RoomMaintenanceSettingsEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'room_maintenance_settings'
    })
], RoomMaintenanceSettingsEntity);
