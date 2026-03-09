"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VaultModule", {
    enumerable: true,
    get: function() {
        return VaultModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _vaultroomsnapshotentity = require("./entities/vault-room-snapshot.entity");
const _vaultroomsnapshotsservice = require("./services/vault-room-snapshots.service");
const _vaultwshandler = require("./ws/vault-ws.handler");
const _vaultwsregistrar = require("./ws/vault-ws.registrar");
const _roommodule = require("../room/room.module");
const _botmodule = require("../bot/bot.module");
const _gamemodule = require("../game/game.module");
const _presencemodule = require("../presence/presence.module");
const _notificationmodule = require("../notification/notification.module");
const _roombotentity = require("../room/entities/room-bot.entity");
const _gameregistrymodule = require("../game/engine/game-registry.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let VaultModule = class VaultModule {
};
VaultModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _vaultroomsnapshotentity.VaultRoomSnapshotEntity,
                _roombotentity.RoomBot
            ]),
            _roommodule.RoomModule,
            _botmodule.BotModule,
            _gameregistrymodule.GameRegistryModule,
            _gamemodule.GameModule,
            _presencemodule.PresenceModule,
            _notificationmodule.NotificationModule
        ],
        providers: [
            _vaultroomsnapshotsservice.VaultRoomSnapshotsService,
            _vaultwshandler.VaultWsHandler,
            _vaultwsregistrar.VaultWsRegistrar
        ],
        exports: [
            _vaultroomsnapshotsservice.VaultRoomSnapshotsService
        ]
    })
], VaultModule);
