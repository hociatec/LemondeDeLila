"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FouleesFantastiquesModule", {
    enumerable: true,
    get: function() {
        return FouleesFantastiquesModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _fouleesfantastiquesservice = require("./foulees-fantastiques.service");
const _fouleesfantastiquessetupservice = require("./setup/foulees-fantastiques-setup.service");
const _fouleesfantastiquesactionservice = require("./actions/foulees-fantastiques-action.service");
const _fouleesfantastiquesphaseservice = require("./phases/foulees-fantastiques-phase.service");
const _fouleesfantastiquespresenterservice = require("./presenter/foulees-fantastiques-presenter.service");
const _fouleesfantastiquesbotservice = require("./bots/foulees-fantastiques-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let FouleesFantastiquesModule = class FouleesFantastiquesModule {
};
FouleesFantastiquesModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule,
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _setupflowmodule.SetupFlowModule
        ],
        providers: [
            _fouleesfantastiquesservice.FouleesFantastiquesService,
            _fouleesfantastiquessetupservice.FouleesFantastiquesSetupService,
            _fouleesfantastiquesactionservice.FouleesFantastiquesActionService,
            _fouleesfantastiquesphaseservice.FouleesFantastiquesPhaseService,
            _fouleesfantastiquespresenterservice.FouleesFantastiquesPresenterService,
            _fouleesfantastiquesbotservice.FouleesFantastiquesBotService
        ],
        exports: [
            _fouleesfantastiquesservice.FouleesFantastiquesService
        ]
    })
], FouleesFantastiquesModule);
