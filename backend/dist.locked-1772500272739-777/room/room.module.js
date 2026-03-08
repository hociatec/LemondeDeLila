"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoomModule", {
    enumerable: true,
    get: function() {
        return RoomModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _roomentity = require("./entities/room.entity");
const _roomparticipantentity = require("./entities/room-participant.entity");
const _roombotentity = require("./entities/room-bot.entity");
const _roomservice = require("./services/room.service");
const _roomgateway = require("./gateways/room.gateway");
const _userentity = require("../user/entities/user.entity");
const _botmodule = require("../bot/bot.module");
const _presencemodule = require("../presence/presence.module");
const _notificationmodule = require("../notification/notification.module");
const _roominviteservice = require("./services/room-invite.service");
const _roomlobbywshandler = require("./gateways/room-lobby-ws.handler");
const _roomwsregistrar = require("./gateways/room-ws.registrar");
const _catalogmodule = require("../catalog/catalog.module");
const _statsmodule = require("../stats/stats.module");
const _clientupdatesmodule = require("../client-updates/client-updates.module");
const _roomlobbyrefreshservice = require("./services/room-lobby-refresh.service");
const _roomlobbyrefreshbinder = require("./services/room-lobby-refresh.binder");
const _roomrealtimetrackerservice = require("./services/room-realtime-tracker.service");
const _roomautocleanupservice = require("./services/room-auto-cleanup.service");
const _roommaintenancesettingsservice = require("./services/room-maintenance-settings.service");
const _roommaintenancesettingsentity = require("./entities/room-maintenance-settings.entity");
const _vaultroomsnapshotentity = require("../vault/entities/vault-room-snapshot.entity");
const _soundsmodule = require("../sounds/sounds.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let RoomModule = class RoomModule {
};
RoomModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _roomentity.Room,
                _roomparticipantentity.RoomParticipant,
                _roombotentity.RoomBot,
                _roommaintenancesettingsentity.RoomMaintenanceSettingsEntity,
                _vaultroomsnapshotentity.VaultRoomSnapshotEntity,
                _userentity.User
            ]),
            (0, _common.forwardRef)(()=>_botmodule.BotModule),
            (0, _common.forwardRef)(()=>_presencemodule.PresenceModule),
            _notificationmodule.NotificationModule,
            _clientupdatesmodule.ClientUpdatesModule,
            _soundsmodule.SoundsModule,
            _catalogmodule.CatalogModule,
            _statsmodule.StatsModule
        ],
        providers: [
            _roomservice.RoomService,
            _roomgateway.RoomGateway,
            _roominviteservice.RoomInviteService,
            _roomlobbyrefreshservice.RoomLobbyRefreshService,
            _roomlobbyrefreshbinder.RoomLobbyRefreshBinder,
            _roomrealtimetrackerservice.RoomRealtimeTrackerService,
            _roommaintenancesettingsservice.RoomMaintenanceSettingsService,
            _roomautocleanupservice.RoomAutoCleanupService,
            _roomlobbywshandler.RoomLobbyWsHandler,
            _roomwsregistrar.RoomWsRegistrar
        ],
        exports: [
            _roomservice.RoomService,
            _roommaintenancesettingsservice.RoomMaintenanceSettingsService
        ]
    })
], RoomModule);
