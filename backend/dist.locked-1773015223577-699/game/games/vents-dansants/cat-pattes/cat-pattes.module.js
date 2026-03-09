"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CatPattesModule", {
    enumerable: true,
    get: function() {
        return CatPattesModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _turnpoliciesmodule = require("../../../modules/turn-policies/turn-policies.module");
const _promptpoliciesmodule = require("../../../modules/prompt-policies/prompt-policies.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _catpattesservice = require("./cat-pattes.service");
const _catpattessetupservice = require("./setup/cat-pattes-setup.service");
const _catpattesactionservice = require("./actions/cat-pattes-action.service");
const _catpattespresenterservice = require("./presenter/cat-pattes-presenter.service");
const _catpattesbotservice = require("./bots/cat-pattes-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let CatPattesModule = class CatPattesModule {
};
CatPattesModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _setupflowmodule.SetupFlowModule,
            _turnpoliciesmodule.TurnPoliciesModule,
            _promptpoliciesmodule.PromptPoliciesModule
        ],
        providers: [
            _catpattesservice.CatPattesService,
            _catpattessetupservice.CatPattesSetupService,
            _catpattesactionservice.CatPattesActionService,
            _catpattespresenterservice.CatPattesPresenterService,
            _catpattesbotservice.CatPattesBotService
        ],
        exports: [
            _catpattesservice.CatPattesService
        ]
    })
], CatPattesModule);
