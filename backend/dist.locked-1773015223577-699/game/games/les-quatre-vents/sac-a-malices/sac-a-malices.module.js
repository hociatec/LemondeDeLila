"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SacAMalicesModule", {
    enumerable: true,
    get: function() {
        return SacAMalicesModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _sacamalicesservice = require("./sac-a-malices.service");
const _sacamalicessetupservice = require("./setup/sac-a-malices-setup.service");
const _sacamalicesactionservice = require("./actions/sac-a-malices-action.service");
const _sacamalicespresenterservice = require("./presenter/sac-a-malices-presenter.service");
const _sacamalicesbotservice = require("./bots/sac-a-malices-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let SacAMalicesModule = class SacAMalicesModule {
};
SacAMalicesModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule,
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _setupflowmodule.SetupFlowModule
        ],
        providers: [
            _sacamalicesservice.SacAMalicesService,
            _sacamalicessetupservice.SacAMalicesSetupService,
            _sacamalicesactionservice.SacAMalicesActionService,
            _sacamalicespresenterservice.SacAMalicesPresenterService,
            _sacamalicesbotservice.SacAMalicesBotService
        ],
        exports: [
            _sacamalicesservice.SacAMalicesService
        ]
    })
], SacAMalicesModule);
