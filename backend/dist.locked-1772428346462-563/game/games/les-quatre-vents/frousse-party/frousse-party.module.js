"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FroussePartyModule", {
    enumerable: true,
    get: function() {
        return FroussePartyModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _boardeffectspoliciesmodule = require("../../../modules/board-effects-policies/board-effects-policies.module");
const _turnpoliciesmodule = require("../../../modules/turn-policies/turn-policies.module");
const _promptpoliciesmodule = require("../../../modules/prompt-policies/prompt-policies.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _froussepartyservice = require("./frousse-party.service");
const _froussesetupservice = require("./setup/frousse-setup.service");
const _frousseactionservice = require("./actions/frousse-action.service");
const _froussepresenterservice = require("./presenter/frousse-presenter.service");
const _froussebotservice = require("./bots/frousse-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let FroussePartyModule = class FroussePartyModule {
};
FroussePartyModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule,
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _setupflowmodule.SetupFlowModule,
            _boardeffectspoliciesmodule.BoardEffectsPoliciesModule,
            _turnpoliciesmodule.TurnPoliciesModule,
            _promptpoliciesmodule.PromptPoliciesModule
        ],
        providers: [
            _froussepartyservice.FroussePartyService,
            _froussesetupservice.FrousseSetupService,
            _frousseactionservice.FrousseActionService,
            _froussepresenterservice.FroussePresenterService,
            _froussebotservice.FrousseBotService
        ],
        exports: [
            _froussepartyservice.FroussePartyService
        ]
    })
], FroussePartyModule);
