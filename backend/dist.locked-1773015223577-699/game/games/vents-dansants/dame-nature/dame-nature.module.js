"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DameNatureModule", {
    enumerable: true,
    get: function() {
        return DameNatureModule;
    }
});
const _common = require("@nestjs/common");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _coremodule = require("../../../core/core.module");
const _damenatureservice = require("./dame-nature.service");
const _damenaturesetupservice = require("./setup/dame-nature-setup.service");
const _damenatureactionservice = require("./actions/dame-nature-action.service");
const _damenaturepresenterservice = require("./presenter/dame-nature-presenter.service");
const _damenaturebotservice = require("./bots/dame-nature-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let DameNatureModule = class DameNatureModule {
};
DameNatureModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _damenatureservice.DameNatureService,
            _damenaturesetupservice.DameNatureSetupService,
            _damenatureactionservice.DameNatureActionService,
            _damenaturepresenterservice.DameNaturePresenterService,
            _damenaturebotservice.DameNatureBotService
        ],
        exports: [
            _damenatureservice.DameNatureService
        ]
    })
], DameNatureModule);
