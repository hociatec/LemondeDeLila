"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ContesModule", {
    enumerable: true,
    get: function() {
        return ContesModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _turnpoliciesmodule = require("../../../modules/turn-policies/turn-policies.module");
const _contesservice = require("./contes.service");
const _contesetcacahuetessetupservice = require("./setup/contes-et-cacahuetes-setup.service");
const _contesactionservice = require("./actions/contes-action.service");
const _contespresenterservice = require("./presenter/contes-presenter.service");
const _contesbotservice = require("./bots/contes-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ContesModule = class ContesModule {
};
ContesModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _setupflowmodule.SetupFlowModule,
            _turnpoliciesmodule.TurnPoliciesModule
        ],
        providers: [
            _contesservice.ContesService,
            _contesetcacahuetessetupservice.ContesCacahuetesSetupService,
            _contesactionservice.ContesActionService,
            _contespresenterservice.ContesPresenterService,
            _contesbotservice.ContesBotService
        ],
        exports: [
            _contesservice.ContesService
        ]
    })
], ContesModule);
