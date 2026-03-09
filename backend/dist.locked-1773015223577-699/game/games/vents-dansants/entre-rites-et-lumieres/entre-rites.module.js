"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EntreRitesModule", {
    enumerable: true,
    get: function() {
        return EntreRitesModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _entreritesactionservice = require("./actions/entre-rites-action.service");
const _entreritespresenterservice = require("./presenter/entre-rites-presenter.service");
const _entreritessetupservice = require("./setup/entre-rites-setup.service");
const _entreritesservice = require("./entre-rites.service");
const _entreritesbotservice = require("./bots/entre-rites-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let EntreRitesModule = class EntreRitesModule {
};
EntreRitesModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _entreritesservice.EntreRitesService,
            _entreritessetupservice.EntreRitesSetupService,
            _entreritesactionservice.EntreRitesActionService,
            _entreritespresenterservice.EntreRitesPresenterService,
            _entreritesbotservice.EntreRitesBotService
        ],
        exports: [
            _entreritesservice.EntreRitesService
        ]
    })
], EntreRitesModule);
