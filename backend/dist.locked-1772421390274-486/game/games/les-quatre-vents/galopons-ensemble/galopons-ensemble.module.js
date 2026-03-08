"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GaloponsEnsembleModule", {
    enumerable: true,
    get: function() {
        return GaloponsEnsembleModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _galoponsensembleservice = require("./galopons-ensemble.service");
const _galoponssetupservice = require("./setup/galopons-setup.service");
const _galoponsactionservice = require("./actions/galopons-action.service");
const _galoponspresenterservice = require("./presenter/galopons-presenter.service");
const _galoponsbotservice = require("./bots/galopons-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GaloponsEnsembleModule = class GaloponsEnsembleModule {
};
GaloponsEnsembleModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _galoponsensembleservice.GaloponsEnsembleService,
            _galoponssetupservice.GaloponsSetupService,
            _galoponsactionservice.GaloponsActionService,
            _galoponspresenterservice.GaloponsPresenterService,
            _galoponsbotservice.GaloponsBotService
        ],
        exports: [
            _galoponsensembleservice.GaloponsEnsembleService
        ]
    })
], GaloponsEnsembleModule);
