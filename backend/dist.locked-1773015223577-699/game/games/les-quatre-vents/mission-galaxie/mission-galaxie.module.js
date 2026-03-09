"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MissionGalaxieModule", {
    enumerable: true,
    get: function() {
        return MissionGalaxieModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _missiongalaxieservice = require("./mission-galaxie.service");
const _missiongalaxiesetupservice = require("./setup/mission-galaxie-setup.service");
const _missiongalaxieactionservice = require("./actions/mission-galaxie-action.service");
const _missiongalaxiepresenterservice = require("./presenter/mission-galaxie-presenter.service");
const _missiongalaxiebotservice = require("./bots/mission-galaxie-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let MissionGalaxieModule = class MissionGalaxieModule {
};
MissionGalaxieModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _missiongalaxieservice.MissionGalaxieService,
            _missiongalaxiesetupservice.MissionGalaxieSetupService,
            _missiongalaxieactionservice.MissionGalaxieActionService,
            _missiongalaxiepresenterservice.MissionGalaxiePresenterService,
            _missiongalaxiebotservice.MissionGalaxieBotService
        ],
        exports: [
            _missiongalaxieservice.MissionGalaxieService
        ]
    })
], MissionGalaxieModule);
