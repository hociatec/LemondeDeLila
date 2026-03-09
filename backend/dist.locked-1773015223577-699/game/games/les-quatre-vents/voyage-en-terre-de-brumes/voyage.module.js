"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "VoyageModule", {
    enumerable: true,
    get: function() {
        return VoyageModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../../core/core.module");
const _gameregistrymodule = require("../../../engine/game-registry.module");
const _boardgamekitsmodule = require("../../../modules/game-kits/board-game-kits.module");
const _engineservicesmodule = require("../../../engine/services/engine-services.module");
const _voyageservice = require("./voyage.service");
const _voyagesetupservice = require("./setup/voyage-setup.service");
const _voyageactionservice = require("./actions/voyage-action.service");
const _voyagepresenterservice = require("./presenter/voyage-presenter.service");
const _voyagebotservice = require("./bots/voyage-bot.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let VoyageModule = class VoyageModule {
};
VoyageModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _boardgamekitsmodule.BoardGameDeckKitModule,
            _coremodule.GameCoreModule,
            _gameregistrymodule.GameRegistryModule,
            _engineservicesmodule.EngineServicesModule
        ],
        providers: [
            _voyageservice.VoyageService,
            _voyagesetupservice.VoyageSetupService,
            _voyageactionservice.VoyageActionService,
            _voyagepresenterservice.VoyagePresenterService,
            _voyagebotservice.VoyageBotService
        ],
        exports: [
            _voyageservice.VoyageService
        ]
    })
], VoyageModule);
