"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PrimalisModule", {
    enumerable: true,
    get: function() {
        return PrimalisModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _primalisservice = require("./primalis.service");
const _primalissetupservice = require("./setup/primalis-setup.service");
const _primalisactionservice = require("./actions/primalis-action.service");
const _primalispresenterservice = require("./presenter/primalis-presenter.service");
const _primalisbotservice = require("./bots/primalis-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PrimalisModule = class PrimalisModule {
};
PrimalisModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _primalisservice.PrimalisService,
            _primalissetupservice.PrimalisSetupService,
            _primalisactionservice.PrimalisActionService,
            _primalispresenterservice.PrimalisPresenterService,
            _primalisbotservice.PrimalisBotService
        ],
        exports: [
            _primalisservice.PrimalisService
        ]
    })
], PrimalisModule);
