"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PimpMyRideModule", {
    enumerable: true,
    get: function() {
        return PimpMyRideModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _pimpmyrideactionservice = require("./actions/pimp-my-ride-action.service");
const _pimpmyridesetupservice = require("./setup/pimp-my-ride-setup.service");
const _pimpmyridepresenterservice = require("./presenter/pimp-my-ride-presenter.service");
const _pimpmyridebotservice = require("./bots/pimp-my-ride-bot.service");
const _pimpmyridephaseservice = require("./phases/pimp-my-ride-phase.service");
const _pimpmyrideservice = require("./pimp-my-ride.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PimpMyRideModule = class PimpMyRideModule {
};
PimpMyRideModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _pimpmyrideservice.PimpMyRideService,
            _pimpmyridesetupservice.PimpMyRideSetupService,
            _pimpmyrideactionservice.PimpMyRideActionService,
            _pimpmyridepresenterservice.PimpMyRidePresenterService,
            _pimpmyridebotservice.PimpMyRideBotService,
            _pimpmyridephaseservice.PimpMyRidePhaseService
        ],
        exports: [
            _pimpmyrideservice.PimpMyRideService
        ]
    })
], PimpMyRideModule);
