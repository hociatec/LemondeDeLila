"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "JeuOieModule", {
    enumerable: true,
    get: function() {
        return JeuOieModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _turnpoliciesmodule = require("../../../modules/turn-policies/turn-policies.module");
const _promptpoliciesmodule = require("../../../modules/prompt-policies/prompt-policies.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _jeuoieservice = require("./jeu-oie.service");
const _jeuoiesetupservice = require("./setup/jeu-oie-setup.service");
const _jeuoieactionservice = require("./actions/jeu-oie-action.service");
const _jeuoiephaseservice = require("./phases/jeu-oie-phase.service");
const _jeuoiepresenterservice = require("./presenter/jeu-oie-presenter.service");
const _jeuoiebotservice = require("./bots/jeu-oie-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let JeuOieModule = class JeuOieModule {
};
JeuOieModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule,
            _boardgamekitsmodule.BoardGameCoreKitModule,
            _setupflowmodule.SetupFlowModule,
            _turnpoliciesmodule.TurnPoliciesModule,
            _promptpoliciesmodule.PromptPoliciesModule
        ],
        providers: [
            _jeuoieservice.JeuOieService,
            _jeuoiesetupservice.JeuOieSetupService,
            _jeuoieactionservice.JeuOieActionService,
            _jeuoiephaseservice.JeuOiePhaseService,
            _jeuoiepresenterservice.JeuOiePresenterService,
            _jeuoiebotservice.JeuOieBotService
        ],
        exports: [
            _jeuoieservice.JeuOieService
        ]
    })
], JeuOieModule);
