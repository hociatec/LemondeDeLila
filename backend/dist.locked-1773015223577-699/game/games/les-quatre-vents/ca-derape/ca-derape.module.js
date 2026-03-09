"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CaDerapeModule", {
    enumerable: true,
    get: function() {
        return CaDerapeModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _caderapeservice = require("./ca-derape.service");
const _casetup = require("./setup/ca.setup");
const _caactionsservice = require("./actions/ca-actions.service");
const _capresenterservice = require("./presenter/ca-presenter.service");
const _cabotservice = require("./bots/ca-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let CaDerapeModule = class CaDerapeModule {
};
CaDerapeModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _caderapeservice.CaDerapeService,
            _casetup.CaSetupService,
            _caactionsservice.CaActionService,
            _capresenterservice.CaPresenterService,
            _cabotservice.CaBotService
        ],
        exports: [
            _caderapeservice.CaDerapeService
        ]
    })
], CaDerapeModule);
