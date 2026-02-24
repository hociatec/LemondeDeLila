"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const vault_room_snapshot_entity_1 = require("./entities/vault-room-snapshot.entity");
const vault_room_snapshots_service_1 = require("./services/vault-room-snapshots.service");
const vault_ws_handler_1 = require("./ws/vault-ws.handler");
const vault_ws_registrar_1 = require("./ws/vault-ws.registrar");
const room_module_1 = require("../room/room.module");
const bot_module_1 = require("../bot/bot.module");
const game_module_1 = require("../game/game.module");
const presence_module_1 = require("../presence/presence.module");
const notification_module_1 = require("../notification/notification.module");
const room_bot_entity_1 = require("../room/entities/room-bot.entity");
const game_registry_module_1 = require("../game/engine/game-registry.module");
let VaultModule = class VaultModule {
};
exports.VaultModule = VaultModule;
exports.VaultModule = VaultModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([vault_room_snapshot_entity_1.VaultRoomSnapshotEntity, room_bot_entity_1.RoomBot]),
            room_module_1.RoomModule,
            bot_module_1.BotModule,
            game_registry_module_1.GameRegistryModule,
            game_module_1.GameModule,
            presence_module_1.PresenceModule,
            notification_module_1.NotificationModule,
        ],
        providers: [vault_room_snapshots_service_1.VaultRoomSnapshotsService, vault_ws_handler_1.VaultWsHandler, vault_ws_registrar_1.VaultWsRegistrar],
        exports: [vault_room_snapshots_service_1.VaultRoomSnapshotsService],
    })
], VaultModule);
//# sourceMappingURL=vault.module.js.map