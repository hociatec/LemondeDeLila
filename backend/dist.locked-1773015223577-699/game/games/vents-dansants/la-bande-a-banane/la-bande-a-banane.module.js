"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BandeABananeModule", {
    enumerable: true,
    get: function() {
        return BandeABananeModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _labandeabananeactionservice = require("./actions/la-bande-a-banane-action.service");
const _labandeabananebotservice = require("./bots/la-bande-a-banane-bot.service");
const _labandeabananepresenterservice = require("./presenter/la-bande-a-banane-presenter.service");
const _labandeabananesetupservice = require("./setup/la-bande-a-banane-setup.service");
const _labandeabananeservice = require("./la-bande-a-banane.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BandeABananeModule = class BandeABananeModule {
};
BandeABananeModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule
        ],
        providers: [
            _labandeabananeservice.BandeABananeService,
            _labandeabananesetupservice.BandeABananeSetupService,
            _labandeabananeactionservice.BandeABananeActionService,
            _labandeabananepresenterservice.BandeABananePresenterService,
            _labandeabananebotservice.BandeABananeBotService
        ],
        exports: [
            _labandeabananeservice.BandeABananeService
        ]
    })
], BandeABananeModule);
