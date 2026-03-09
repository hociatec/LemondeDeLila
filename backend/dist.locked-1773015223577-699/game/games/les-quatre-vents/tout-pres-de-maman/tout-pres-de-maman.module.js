"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ToutPresDeMamanModule", {
    enumerable: true,
    get: function() {
        return ToutPresDeMamanModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _toutpresdemamanservice = require("./tout-pres-de-maman.service");
const _toutpresdemamansetupservice = require("./setup/tout-pres-de-maman-setup.service");
const _toutpresdemamanactionservice = require("./actions/tout-pres-de-maman-action.service");
const _toutpresdemamanpresenterservice = require("./presenter/tout-pres-de-maman-presenter.service");
const _toutpresdemamanbotservice = require("./bots/tout-pres-de-maman-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ToutPresDeMamanModule = class ToutPresDeMamanModule {
};
ToutPresDeMamanModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _toutpresdemamanservice.ToutPresDeMamanService,
            _toutpresdemamansetupservice.ToutPresDeMamanSetupService,
            _toutpresdemamanactionservice.ToutPresDeMamanActionService,
            _toutpresdemamanpresenterservice.ToutPresDeMamanPresenterService,
            _toutpresdemamanbotservice.ToutPresDeMamanBotService
        ],
        exports: [
            _toutpresdemamanservice.ToutPresDeMamanService
        ]
    })
], ToutPresDeMamanModule);
