"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PiratesEnVadrouilleModule", {
    enumerable: true,
    get: function() {
        return PiratesEnVadrouilleModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _piratesenvadrouilleservice = require("./pirates-en-vadrouille.service");
const _piratesenvadrouillesetupservice = require("./setup/pirates-en-vadrouille-setup.service");
const _piratesenvadrouilleactionservice = require("./actions/pirates-en-vadrouille-action.service");
const _piratesenvadrouillepresenterservice = require("./presenter/pirates-en-vadrouille-presenter.service");
const _piratesenvadrouillebotservice = require("./bots/pirates-en-vadrouille-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PiratesEnVadrouilleModule = class PiratesEnVadrouilleModule {
};
PiratesEnVadrouilleModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _piratesenvadrouilleservice.PiratesEnVadrouilleService,
            _piratesenvadrouillesetupservice.PiratesEnVadrouilleSetupService,
            _piratesenvadrouilleactionservice.PiratesEnVadrouilleActionService,
            _piratesenvadrouillepresenterservice.PiratesEnVadrouillePresenterService,
            _piratesenvadrouillebotservice.PiratesEnVadrouilleBotService
        ],
        exports: [
            _piratesenvadrouilleservice.PiratesEnVadrouilleService
        ]
    })
], PiratesEnVadrouilleModule);
