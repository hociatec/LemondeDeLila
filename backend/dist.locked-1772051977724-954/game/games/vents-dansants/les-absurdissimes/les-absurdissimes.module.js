"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LesAbsurdissimesModule", {
    enumerable: true,
    get: function() {
        return LesAbsurdissimesModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _lesabsurdissimesactionservice = require("./actions/les-absurdissimes-action.service");
const _lesabsurdissimesbotservice = require("./bots/les-absurdissimes-bot.service");
const _absurdissimesdeckservice = require("./data/absurdissimes-deck.service");
const _lesabsurdissimespresenterservice = require("./presenter/les-absurdissimes-presenter.service");
const _lesabsurdissimessetupservice = require("./setup/les-absurdissimes-setup.service");
const _lesabsurdissimesservice = require("./les-absurdissimes.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LesAbsurdissimesModule = class LesAbsurdissimesModule {
};
LesAbsurdissimesModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _lesabsurdissimesservice.LesAbsurdissimesService,
            _absurdissimesdeckservice.AbsurdissimesDeckService,
            _lesabsurdissimessetupservice.AbsurdissimesSetupService,
            _lesabsurdissimesactionservice.AbsurdissimesActionService,
            _lesabsurdissimespresenterservice.AbsurdissimesPresenterService,
            _lesabsurdissimesbotservice.AbsurdissimesBotService
        ],
        exports: [
            _lesabsurdissimesservice.LesAbsurdissimesService
        ]
    })
], LesAbsurdissimesModule);
