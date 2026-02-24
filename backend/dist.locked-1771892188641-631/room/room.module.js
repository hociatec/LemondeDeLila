"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const room_entity_1 = require("./entities/room.entity");
const room_participant_entity_1 = require("./entities/room-participant.entity");
const room_bot_entity_1 = require("./entities/room-bot.entity");
const room_service_1 = require("./services/room.service");
const room_gateway_1 = require("./gateways/room.gateway");
const user_entity_1 = require("../user/entities/user.entity");
const common_2 = require("@nestjs/common");
const bot_module_1 = require("../bot/bot.module");
const presence_module_1 = require("../presence/presence.module");
const notification_module_1 = require("../notification/notification.module");
const room_invite_service_1 = require("./services/room-invite.service");
const room_directory_ws_handler_1 = require("./gateways/room-directory-ws.handler");
const room_ws_registrar_1 = require("./gateways/room-ws.registrar");
const catalog_module_1 = require("../catalog/catalog.module");
const stats_module_1 = require("../stats/stats.module");
const client_updates_module_1 = require("../client-updates/client-updates.module");
const public_room_directory_service_1 = require("./services/public-room-directory.service");
const public_room_directory_binder_1 = require("./services/public-room-directory.binder");
const room_realtime_tracker_service_1 = require("./services/room-realtime-tracker.service");
const room_auto_cleanup_service_1 = require("./services/room-auto-cleanup.service");
const room_maintenance_settings_service_1 = require("./services/room-maintenance-settings.service");
const room_maintenance_settings_entity_1 = require("./entities/room-maintenance-settings.entity");
const vault_room_snapshot_entity_1 = require("../vault/entities/vault-room-snapshot.entity");
let RoomModule = class RoomModule {
};
exports.RoomModule = RoomModule;
exports.RoomModule = RoomModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                room_entity_1.Room,
                room_participant_entity_1.RoomParticipant,
                room_bot_entity_1.RoomBot,
                room_maintenance_settings_entity_1.RoomMaintenanceSettingsEntity,
                vault_room_snapshot_entity_1.VaultRoomSnapshotEntity,
                user_entity_1.User,
            ]),
            (0, common_2.forwardRef)(() => bot_module_1.BotModule),
            (0, common_2.forwardRef)(() => presence_module_1.PresenceModule),
            notification_module_1.NotificationModule,
            client_updates_module_1.ClientUpdatesModule,
            catalog_module_1.CatalogModule,
            stats_module_1.StatsModule,
        ],
        providers: [
            room_service_1.RoomService,
            room_gateway_1.RoomGateway,
            room_invite_service_1.RoomInviteService,
            public_room_directory_service_1.PublicRoomDirectoryService,
            public_room_directory_binder_1.PublicRoomDirectoryBinder,
            room_realtime_tracker_service_1.RoomRealtimeTrackerService,
            room_maintenance_settings_service_1.RoomMaintenanceSettingsService,
            room_auto_cleanup_service_1.RoomAutoCleanupService,
            room_directory_ws_handler_1.RoomDirectoryWsHandler,
            room_ws_registrar_1.RoomWsRegistrar,
        ],
        exports: [room_service_1.RoomService, room_maintenance_settings_service_1.RoomMaintenanceSettingsService],
    })
], RoomModule);
//# sourceMappingURL=room.module.js.map