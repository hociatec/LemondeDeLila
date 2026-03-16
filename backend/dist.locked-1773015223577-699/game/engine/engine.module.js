"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EngineModule", {
    enumerable: true,
    get: function() {
        return EngineModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _typeorm = require("@nestjs/typeorm");
const _roommodule = require("../../room/room.module");
const _coremodule = require("../core/core.module");
const _botmodule = require("../modules/bot/bot.module");
const _gridmodule = require("../modules/grid/grid.module");
const _turnmodule = require("../modules/turn/turn.module");
const _gameregistrymodule = require("./game-registry.module");
const _gameengineservice = require("./services/game-engine.service");
const _gameenginestatestore = require("./services/game-engine-state.store");
const _gamecontentservice = require("./services/game-content.service");
const _gamegateway = require("./gateways/game.gateway");
const _engineservicesmodule = require("./services/engine-services.module");
const _statsmodule = require("../../stats/stats.module");
const _clientupdatesmodule = require("../../client-updates/client-updates.module");
const _socialprofileentity = require("../../social/entities/social-profile.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let EngineModule = class EngineModule {
};
EngineModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _config.ConfigModule,
            _typeorm.TypeOrmModule.forFeature([
                _socialprofileentity.SocialProfile
            ]),
            _roommodule.RoomModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _botmodule.BotModule,
            _gridmodule.GridModule,
            _turnmodule.TurnModule,
            _engineservicesmodule.EngineServicesModule,
            _statsmodule.StatsModule,
            _clientupdatesmodule.ClientUpdatesModule
        ],
        providers: [
            _gameengineservice.GameEngineService,
            _gameenginestatestore.GameEngineStateStore,
            _gamecontentservice.GameContentService,
            _gamegateway.GameGateway
        ],
        exports: [
            _gameengineservice.GameEngineService,
            _engineservicesmodule.EngineServicesModule
        ]
    })
], EngineModule);
