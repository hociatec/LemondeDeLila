"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AventureSauvageModule", {
    enumerable: true,
    get: function() {
        return AventureSauvageModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _boardeffectspoliciesmodule = require("../../../modules/board-effects-policies/board-effects-policies.module");
const _turnpoliciesmodule = require("../../../modules/turn-policies/turn-policies.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _aventuresauvageservice = require("./aventure-sauvage.service");
const _aventuresauvagesetupservice = require("./setup/aventure-sauvage-setup.service");
const _aventuresauvageactionservice = require("./actions/aventure-sauvage-action.service");
const _aventuresauvagepresenterservice = require("./presenter/aventure-sauvage-presenter.service");
const _aventuresauvagebotservice = require("./bots/aventure-sauvage-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let AventureSauvageModule = class AventureSauvageModule {
};
AventureSauvageModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule,
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _setupflowmodule.SetupFlowModule,
            _boardeffectspoliciesmodule.BoardEffectsPoliciesModule,
            _turnpoliciesmodule.TurnPoliciesModule
        ],
        providers: [
            _aventuresauvageservice.AventureSauvageService,
            _aventuresauvagesetupservice.AventureSauvageSetupService,
            _aventuresauvageactionservice.AventureSauvageActionService,
            _aventuresauvagepresenterservice.AventureSauvagePresenterService,
            _aventuresauvagebotservice.AventureSauvageBotService
        ],
        exports: [
            _aventuresauvageservice.AventureSauvageService
        ]
    })
], AventureSauvageModule);
