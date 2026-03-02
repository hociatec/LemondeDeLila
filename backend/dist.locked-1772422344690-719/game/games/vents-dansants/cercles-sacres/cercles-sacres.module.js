"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CerclesSacresModule", {
    enumerable: true,
    get: function() {
        return CerclesSacresModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _cerclessacresservice = require("./cercles-sacres.service");
const _cerclessacressetupservice = require("./setup/cercles-sacres-setup.service");
const _cerclessacresactionservice = require("./actions/cercles-sacres-action.service");
const _cerclessacrespresenterservice = require("./presenter/cercles-sacres-presenter.service");
const _cerclessacresbotservice = require("./bots/cercles-sacres-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let CerclesSacresModule = class CerclesSacresModule {
};
CerclesSacresModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _cerclessacresservice.CerclesSacresService,
            _cerclessacressetupservice.CerclesSacresSetupService,
            _cerclessacresactionservice.CerclesSacresActionService,
            _cerclessacrespresenterservice.CerclesSacresPresenterService,
            _cerclessacresbotservice.CerclesSacresBotService
        ],
        exports: [
            _cerclessacresservice.CerclesSacresService
        ]
    })
], CerclesSacresModule);
