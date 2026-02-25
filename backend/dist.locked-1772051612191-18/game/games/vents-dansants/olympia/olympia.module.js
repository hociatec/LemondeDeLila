"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OlympiaModule", {
    enumerable: true,
    get: function() {
        return OlympiaModule;
    }
});
const _common = require("@nestjs/common");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _coremodule = require("../../../core/core.module");
const _olympiaservice = require("./olympia.service");
const _olympiasetupservice = require("./setup/olympia-setup.service");
const _olympiaactionservice = require("./actions/olympia-action.service");
const _olympiapresenterservice = require("./presenter/olympia-presenter.service");
const _olympiabotservice = require("./bots/olympia-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let OlympiaModule = class OlympiaModule {
};
OlympiaModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _olympiaservice.OlympiaService,
            _olympiasetupservice.OlympiaSetupService,
            _olympiaactionservice.OlympiaActionService,
            _olympiapresenterservice.OlympiaPresenterService,
            _olympiabotservice.OlympiaBotService
        ],
        exports: [
            _olympiaservice.OlympiaService
        ]
    })
], OlympiaModule);
