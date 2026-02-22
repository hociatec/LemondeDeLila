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
exports.AdminRoomsWsHandler = void 0;
const common_1 = require("@nestjs/common");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const room_service_1 = require("../../room/services/room.service");
const room_maintenance_settings_service_1 = require("../../room/services/room-maintenance-settings.service");
const admin_rooms_cleanup_dto_1 = require("./admin-rooms-cleanup.dto");
const admin_rooms_destroy_dto_1 = require("./admin-rooms-destroy.dto");
const admin_rooms_list_dto_1 = require("./admin-rooms-list.dto");
const admin_rooms_settings_dto_1 = require("./admin-rooms-settings.dto");
let AdminRoomsWsHandler = class AdminRoomsWsHandler {
    validator;
    rooms;
    roomSettings;
    constructor(validator, rooms, roomSettings) {
        this.validator = validator;
        this.rooms = rooms;
        this.roomSettings = roomSettings;
    }
    async roomsCleanup(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_rooms_cleanup_dto_1.AdminRoomsCleanupWsDto, payload);
        if (dto.confirm !== true) {
            throw new common_1.BadRequestException('Confirmation requise.');
        }
        const res = await this.rooms.adminCleanupRooms({
            includePrivate: dto.includePrivate === true,
            includeStarted: dto.includeStarted === true,
            olderThanMinutes: dto.olderThanMinutes,
            limit: dto.limit,
            dryRun: dto.dryRun === true,
            excludeActivePlayers: true,
        });
        return { type: 'admin.rooms.cleanup', payload: res };
    }
    async roomsList(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_rooms_list_dto_1.AdminRoomsListWsDto, payload ?? {});
        const res = await this.rooms.adminListRooms({
            limit: dto.limit,
            includePrivate: dto.includePrivate !== false,
            includeStarted: dto.includeStarted === true,
            joinableOnly: dto.joinableOnly === true,
        });
        return { type: 'admin.rooms.list', payload: res };
    }
    async roomsDestroy(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_rooms_destroy_dto_1.AdminRoomsDestroyWsDto, payload);
        if (dto.confirm !== true) {
            throw new common_1.BadRequestException('Confirmation requise.');
        }
        const res = await this.rooms.adminDestroyRoom(dto.roomId);
        return { type: 'admin.rooms.destroy', payload: res };
    }
    roomsSettingsGet(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        this.validator.validate(admin_rooms_settings_dto_1.AdminRoomsSettingsGetWsDto, payload ?? {});
        return {
            type: 'admin.rooms.settings.get',
            payload: this.roomSettings.get(),
        };
    }
    async roomsSettingsUpdate(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_rooms_settings_dto_1.AdminRoomsSettingsUpdateWsDto, payload);
        const updated = await this.roomSettings.update({
            autoCleanupEnabled: typeof dto.autoCleanupEnabled === 'boolean'
                ? dto.autoCleanupEnabled
                : undefined,
            autoCleanupOlderThanMinutes: dto.autoCleanupOlderThanMinutes ?? undefined,
            autoCleanupIntervalSeconds: dto.autoCleanupIntervalSeconds ?? undefined,
            autoCleanupLimit: dto.autoCleanupLimit ?? undefined,
        });
        return { type: 'admin.rooms.settings.update', payload: updated };
    }
};
exports.AdminRoomsWsHandler = AdminRoomsWsHandler;
exports.AdminRoomsWsHandler = AdminRoomsWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        room_service_1.RoomService,
        room_maintenance_settings_service_1.RoomMaintenanceSettingsService])
], AdminRoomsWsHandler);
//# sourceMappingURL=admin-rooms-ws.handler.js.map