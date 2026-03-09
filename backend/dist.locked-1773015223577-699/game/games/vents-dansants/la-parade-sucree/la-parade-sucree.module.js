"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LaParadeSucreeModule", {
    enumerable: true,
    get: function() {
        return LaParadeSucreeModule;
    }
});
const _common = require("@nestjs/common");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _coremodule = require("../../../core/core.module");
const _laparadesucreeservice = require("./la-parade-sucree.service");
const _laparadesucreesetupservice = require("./setup/la-parade-sucree-setup.service");
const _laparadesucreeactionservice = require("./actions/la-parade-sucree-action.service");
const _laparadesucreepresenterservice = require("./presenter/la-parade-sucree-presenter.service");
const _laparadesucreebotservice = require("./bots/la-parade-sucree-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LaParadeSucreeModule = class LaParadeSucreeModule {
};
LaParadeSucreeModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _laparadesucreeservice.LaParadeSucreeService,
            _laparadesucreesetupservice.LaParadeSucreeSetupService,
            _laparadesucreeactionservice.LaParadeSucreeActionService,
            _laparadesucreepresenterservice.LaParadeSucreePresenterService,
            _laparadesucreebotservice.LaParadeSucreeBotService
        ],
        exports: [
            _laparadesucreeservice.LaParadeSucreeService
        ]
    })
], LaParadeSucreeModule);
