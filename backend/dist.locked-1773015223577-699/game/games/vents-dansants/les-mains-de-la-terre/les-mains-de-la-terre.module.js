"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LesMainsDeLaTerreModule", {
    enumerable: true,
    get: function() {
        return LesMainsDeLaTerreModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _lesmainsdelaterreactionservice = require("./actions/les-mains-de-la-terre-action.service");
const _lesmainsdelaterrebotservice = require("./bots/les-mains-de-la-terre-bot.service");
const _lesmainsdelaterreservice = require("./les-mains-de-la-terre.service");
const _lesmainsdelaterrepresenterservice = require("./presenter/les-mains-de-la-terre-presenter.service");
const _lesmainsdelaterresetupservice = require("./setup/les-mains-de-la-terre-setup.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LesMainsDeLaTerreModule = class LesMainsDeLaTerreModule {
};
LesMainsDeLaTerreModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _lesmainsdelaterreservice.LesMainsDeLaTerreService,
            _lesmainsdelaterresetupservice.LesMainsSetupService,
            _lesmainsdelaterreactionservice.LesMainsActionService,
            _lesmainsdelaterrepresenterservice.LesMainsPresenterService,
            _lesmainsdelaterrebotservice.LesMainsDeLaTerreBotService
        ],
        exports: [
            _lesmainsdelaterreservice.LesMainsDeLaTerreService
        ]
    })
], LesMainsDeLaTerreModule);
