"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AFondLesBallonsModule", {
    enumerable: true,
    get: function() {
        return AFondLesBallonsModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _setupflowmodule = require("../../../modules/setup-flow/setup-flow.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _afondlesballonsservice = require("./a-fond-les-ballons.service");
const _afondlesballonssetupservice = require("./setup/a-fond-les-ballons-setup.service");
const _afondlesballonsactionservice = require("./actions/a-fond-les-ballons-action.service");
const _afondlesballonspresenterservice = require("./presenter/a-fond-les-ballons-presenter.service");
const _afondlesballonsbotservice = require("./bots/a-fond-les-ballons-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let AFondLesBallonsModule = class AFondLesBallonsModule {
};
AFondLesBallonsModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule,
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _setupflowmodule.SetupFlowModule
        ],
        providers: [
            _afondlesballonsservice.AFondLesBallonsService,
            _afondlesballonssetupservice.AFondLesBallonsSetupService,
            _afondlesballonsactionservice.AFondLesBallonsActionService,
            _afondlesballonspresenterservice.AFondLesBallonsPresenterService,
            _afondlesballonsbotservice.AFondLesBallonsBotService
        ],
        exports: [
            _afondlesballonsservice.AFondLesBallonsService
        ]
    })
], AFondLesBallonsModule);
