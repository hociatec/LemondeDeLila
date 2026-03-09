"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GerardPresidentModule", {
    enumerable: true,
    get: function() {
        return GerardPresidentModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _gerardpresidentactionservice = require("./actions/gerard-president-action.service");
const _gerardpresidentbotservice = require("./bots/gerard-president-bot.service");
const _gerardpresidentpresenterservice = require("./presenter/gerard-president-presenter.service");
const _gerardpresidentsetupservice = require("./setup/gerard-president-setup.service");
const _gerardpresidentservice = require("./gerard-president.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GerardPresidentModule = class GerardPresidentModule {
};
GerardPresidentModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _gerardpresidentservice.GerardPresidentService,
            _gerardpresidentsetupservice.GerardPresidentSetupService,
            _gerardpresidentactionservice.GerardPresidentActionService,
            _gerardpresidentpresenterservice.GerardPresidentPresenterService,
            _gerardpresidentbotservice.GerardPresidentBotService
        ],
        exports: [
            _gerardpresidentservice.GerardPresidentService
        ]
    })
], GerardPresidentModule);
