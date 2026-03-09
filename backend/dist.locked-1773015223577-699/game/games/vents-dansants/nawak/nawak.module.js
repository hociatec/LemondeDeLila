"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NawakModule", {
    enumerable: true,
    get: function() {
        return NawakModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _nawakactionservice = require("./actions/nawak-action.service");
const _nawakbotservice = require("./bots/nawak-bot.service");
const _nawakchallengeservice = require("./data/nawak-challenge.service");
const _nawakpresenterservice = require("./presenter/nawak-presenter.service");
const _nawaksetupservice = require("./setup/nawak-setup.service");
const _nawakservice = require("./nawak.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let NawakModule = class NawakModule {
};
NawakModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _nawakservice.NawakService,
            _nawakchallengeservice.NawakChallengeService,
            _nawaksetupservice.NawakSetupService,
            _nawakactionservice.NawakActionService,
            _nawakpresenterservice.NawakPresenterService,
            _nawakbotservice.NawakBotService
        ],
        exports: [
            _nawakservice.NawakService
        ]
    })
], NawakModule);
