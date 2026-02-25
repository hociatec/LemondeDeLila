"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomMaintenanceSettingsEntity = void 0;
const typeorm_1 = require("typeorm");
let RoomMaintenanceSettingsEntity = class RoomMaintenanceSettingsEntity {
    id;
    autoCleanupEnabled;
    autoCleanupOlderThanMinutes;
    autoCleanupIntervalSeconds;
    autoCleanupLimit;
};
exports.RoomMaintenanceSettingsEntity = RoomMaintenanceSettingsEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'tinyint' }),
    __metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'auto_cleanup_enabled', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'auto_cleanup_older_than_minutes', type: 'int', default: 60 }),
    __metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupOlderThanMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'auto_cleanup_interval_seconds', type: 'int', default: 300 }),
    __metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupIntervalSeconds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'auto_cleanup_limit', type: 'int', default: 1000 }),
    __metadata("design:type", Number)
], RoomMaintenanceSettingsEntity.prototype, "autoCleanupLimit", void 0);
exports.RoomMaintenanceSettingsEntity = RoomMaintenanceSettingsEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'room_maintenance_settings' })
], RoomMaintenanceSettingsEntity);
//# sourceMappingURL=room-maintenance-settings.entity.js.map