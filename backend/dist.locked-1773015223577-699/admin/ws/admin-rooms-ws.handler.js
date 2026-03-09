"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminRoomsWsHandler", {
    enumerable: true,
    get: function() {
        return AdminRoomsWsHandler;
    }
});
const _common = require("@nestjs/common");
const _wsauth = require("../../common/ws/ws-auth");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _roomservice = require("../../room/services/room.service");
const _roommaintenancesettingsservice = require("../../room/services/room-maintenance-settings.service");
const _adminroomscleanupdto = require("./admin-rooms-cleanup.dto");
const _adminroomsdestroydto = require("./admin-rooms-destroy.dto");
const _adminroomslistdto = require("./admin-rooms-list.dto");
const _adminroomssettingsdto = require("./admin-rooms-settings.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminRoomsWsHandler = class AdminRoomsWsHandler {
    async roomsCleanup(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminroomscleanupdto.AdminRoomsCleanupWsDto, payload);
        if (dto.confirm !== true) {
            throw new _common.BadRequestException('Confirmation requise.');
        }
        const res = await this.rooms.adminCleanupRooms({
            includePrivate: dto.includePrivate === true,
            includeStarted: dto.includeStarted === true,
            olderThanMinutes: dto.olderThanMinutes,
            limit: dto.limit,
            dryRun: dto.dryRun === true,
            excludeActivePlayers: true
        });
        return {
            type: 'admin.rooms.cleanup',
            payload: res
        };
    }
    async roomsList(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminroomslistdto.AdminRoomsListWsDto, payload ?? {});
        const res = await this.rooms.adminListRooms({
            limit: dto.limit,
            includePrivate: dto.includePrivate !== false,
            includeStarted: dto.includeStarted === true,
            joinableOnly: dto.joinableOnly === true
        });
        return {
            type: 'admin.rooms.list',
            payload: res
        };
    }
    async roomsDestroy(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminroomsdestroydto.AdminRoomsDestroyWsDto, payload);
        if (dto.confirm !== true) {
            throw new _common.BadRequestException('Confirmation requise.');
        }
        const res = await this.rooms.adminDestroyRoom(dto.roomId);
        return {
            type: 'admin.rooms.destroy',
            payload: res
        };
    }
    roomsSettingsGet(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        this.validator.validate(_adminroomssettingsdto.AdminRoomsSettingsGetWsDto, payload ?? {});
        return {
            type: 'admin.rooms.settings.get',
            payload: this.roomSettings.get()
        };
    }
    async roomsSettingsUpdate(session, payload) {
        (0, _wsauth.requireAdmin)(session);
        const dto = this.validator.validate(_adminroomssettingsdto.AdminRoomsSettingsUpdateWsDto, payload);
        const updated = await this.roomSettings.update({
            autoCleanupEnabled: typeof dto.autoCleanupEnabled === 'boolean' ? dto.autoCleanupEnabled : undefined,
            autoCleanupOlderThanMinutes: dto.autoCleanupOlderThanMinutes ?? undefined,
            autoCleanupIntervalSeconds: dto.autoCleanupIntervalSeconds ?? undefined,
            autoCleanupLimit: dto.autoCleanupLimit ?? undefined
        });
        return {
            type: 'admin.rooms.settings.update',
            payload: updated
        };
    }
    constructor(validator, rooms, roomSettings){
        this.validator = validator;
        this.rooms = rooms;
        this.roomSettings = roomSettings;
    }
};
AdminRoomsWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService,
        typeof _roomservice.RoomService === "undefined" ? Object : _roomservice.RoomService,
        typeof _roommaintenancesettingsservice.RoomMaintenanceSettingsService === "undefined" ? Object : _roommaintenancesettingsservice.RoomMaintenanceSettingsService
    ])
], AdminRoomsWsHandler);
