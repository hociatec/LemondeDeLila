"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OdysseeQuatreCieuxModule", {
    enumerable: true,
    get: function() {
        return OdysseeQuatreCieuxModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _odysseeservice = require("./odyssee.service");
const _odysseesetupservice = require("./setup/odyssee-setup.service");
const _odysseeactionservice = require("./actions/odyssee-action.service");
const _odysseepresenterservice = require("./presenter/odyssee-presenter.service");
const _odysseebotservice = require("./bots/odyssee-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let OdysseeQuatreCieuxModule = class OdysseeQuatreCieuxModule {
};
OdysseeQuatreCieuxModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _boardgamekitsmodule.BoardGameCoreKitModule
        ],
        providers: [
            _odysseeservice.OdysseeQuatreCieuxService,
            _odysseesetupservice.OdysseeSetupService,
            _odysseeactionservice.OdysseeActionService,
            _odysseepresenterservice.OdysseePresenterService,
            _odysseebotservice.OdysseeBotService
        ],
        exports: [
            _odysseeservice.OdysseeQuatreCieuxService
        ]
    })
], OdysseeQuatreCieuxModule);
