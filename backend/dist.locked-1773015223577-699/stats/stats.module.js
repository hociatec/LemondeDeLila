"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "StatsModule", {
    enumerable: true,
    get: function() {
        return StatsModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _catalogmodule = require("../catalog/catalog.module");
const _socialmodule = require("../social/social.module");
const _userentity = require("../user/entities/user.entity");
const _gamematchentity = require("./entities/game-match.entity");
const _gamematchplayerentity = require("./entities/game-match-player.entity");
const _gamestatsservice = require("./services/game-stats.service");
const _statswshandler = require("./ws/stats-ws.handler");
const _statswsregistrar = require("./ws/stats-ws.registrar");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let StatsModule = class StatsModule {
};
StatsModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _gamematchentity.GameMatch,
                _gamematchplayerentity.GameMatchPlayer,
                _userentity.User
            ]),
            _catalogmodule.CatalogModule,
            _socialmodule.SocialModule
        ],
        providers: [
            _gamestatsservice.GameStatsService,
            _statswshandler.StatsWsHandler,
            _statswsregistrar.StatsWsRegistrar
        ],
        exports: [
            _gamestatsservice.GameStatsService
        ]
    })
], StatsModule);
